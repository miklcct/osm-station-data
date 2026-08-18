import {Entrance, Platform, PlatformEdge, Station, type StationsInfo, StopArea} from './models.js';
import queryOverpass, {type Relationship, type Way} from '@derhuerst/query-overpass';
import osmtogeojson from "osmtogeojson";
import Multimap from 'multimap';

export { StopArea, Station, Platform, PlatformEdge, Entrance, type StationsInfo };

interface OsmFeatureProperties {
    type : "node" | "way" | "relation";
    id : number;
    tags : { [name: string]: string };
    relations : { role: string, rel: number, reltags: {[name: string]: string} }[];
    tainted?: true;
}

export async function fetchStationData(crsCodes?: string[], overpassUrl: string = 'https://overpass-api.de/api/interpreter'): Promise<StationsInfo> {
    const formattedCrs = crsCodes && crsCodes.length > 0
        ? crsCodes.join('|')
        : '[A-Z]{3}';

    const crsFilter = `["ref:crs"~"^(${formattedCrs})$",i]`;

    // Query updated to use standard ">" recursion. This guarantees osmtogeojson 
    // receives the raw nodes necessary to assemble platform geometries.
    const query = `
        [out:json][timeout:60];
        
        // 1. Fetch initial station elements
        (
            node${crsFilter};
            way${crsFilter};
            relation${crsFilter};
        )->.stations;
        
        // 2. Fetch parent stop_area relations
        (
            rel(bn.stations)["public_transport"="stop_area"];
            rel(bw.stations)["public_transport"="stop_area"];
            rel(br.stations)["public_transport"="stop_area"];
        )->.stopAreas;
        
        // 3. Combine initial elements and stop_area members
        (
            .stations;
            .stopAreas;
            node(r.stopAreas);
            way(r.stopAreas);
            rel(r.stopAreas);
        )->.baseResults;
        
        // 4. Isolate platform ways and relations from results
        (
            way.baseResults["railway"="platform"];
            rel.baseResults["railway"="platform"];
        )->.platforms;
        
        // 5. Extract all nodes comprising the platform geometries
        (
            node(w.platforms);
            node(w(r.platforms));
            node(r.platforms);
        )->.platformNodes;
        
        // 6. Find platform_edge ways sharing any of those platform nodes
        way(bn.platformNodes)["railway"="platform_edge"]->.platformEdges;
        
        // 7. Output base results combined with platform edges
        (
            .baseResults;
            .platformEdges;
        );
        out body;
        >;
        out body qt;
    `;

    const data = await queryOverpass(query, {endpoint: overpassUrl, retryOpts: {retries: 10, factor: 1.1}});
    
    const stopAreasByRelationId = new Map<number, StopArea>();
    const platformIdByNodeId = new Multimap<number, string>();
    const nodesOfWays = new Map<number, number[]>();
    
    for (const element of data) {
        const tags: { [name: string]: string } = element.tags ?? {};
        if (element.type === 'relation' && tags.public_transport === 'stop_area') {
            const stopArea = new StopArea();
            stopArea.atcoCode = tags['naptan:StopAreaCode'];
            stopAreasByRelationId.set(element.id, stopArea);
        }

        if (element.type === 'way') {
            nodesOfWays.set(element.id, (element as Way).nodes);
        }
    }

    for (const element of data) {
        const tags: { [name: string]: string } = element.tags ?? {};
        if (tags.railway === 'platform') {
            if (element.type === 'way') {
                for (const node of (element as Way).nodes) {
                    platformIdByNodeId.set(node, getId(element));
                }
            }
            if (element.type === 'relation' && tags.type === 'multipolygon') {
                for (const member of (element as Relationship).members) {
                    if (member.type === 'way') {
                        for (const node of nodesOfWays.get(member.ref) ?? []) {
                            platformIdByNodeId.set(node, getId(element));
                        }
                    }
                }
            }
        }
    }
    
    const geojson = osmtogeojson({elements: data}, {flatProperties: false});
    const nakedStations: Station[] = [];
    const platformsById = new Map<string, Platform>();
    
    for (const feature of geojson.features) {
        const properties = feature.properties as OsmFeatureProperties;
        if (isStation(properties.tags)) {
            const station = new Station();
            station.atcoCode = properties.tags['naptan:AtcoCode'];
            station.name = properties.tags['name'];
            station.crsCode = properties.tags['ref:crs'];
            station.wheelchair = parseWheelchair(properties.tags);
            station.geojson = feature;
            
            let stopAreaFound = false;

            for (const rel of properties.relations) {
                const stopArea = stopAreasByRelationId.get(rel.rel);
                if (stopArea !== undefined) {
                    stopArea.stations.push(station);
                    stopAreaFound = true;
                }
            }
            
            if (!stopAreaFound) {
                nakedStations.push(station);
            }
        }

        for (const rel of properties.relations) {
            const stopArea = stopAreasByRelationId.get(rel.rel);
            if (stopArea !== undefined) {
                if (rel.role === 'platform' && isPlatform(properties.tags)) {
                    const platform = new Platform();
                    platform.atcoCode = properties.tags['naptan:AtcoCode'];
                    platform.stop_code = properties.tags['local_ref'] ?? properties.tags['ref'];
                    platform.wheelchair = parseWheelchair(properties.tags);
                    platform.geojson = feature;
                    stopArea.platforms.push(platform);
                    platformsById.set(getId(properties), platform);
                }
                
                if (isEntrance(properties.tags)) {
                    const entrance = new Entrance();
                    entrance.atcoCode = properties.tags['naptan:AtcoCode'];
                    entrance.name = properties.tags['name'];
                    entrance.stop_code = properties.tags['ref'];
                    entrance.wheelchair = parseWheelchair(properties.tags);
                    entrance.geojson = feature;
                    stopArea.entrances.push(entrance);
                }
            }
        }        
    }

    for (const feature of geojson.features) {
        const properties = feature.properties as OsmFeatureProperties;
        if (properties.type === 'way' && properties.tags.railway === 'platform_edge') {
            const platformEdge = new PlatformEdge();
            platformEdge.atcoCode = properties.tags['naptan:AtcoCode'];
            platformEdge.stop_code = properties.tags['local_ref'] ?? properties.tags['ref'];
            platformEdge.wheelchair = parseWheelchair(properties.tags);
            platformEdge.geojson = feature;
            for (const rel of properties.relations) {
                if (rel.reltags.type === 'multipolygon' && rel.reltags.railway === 'platform') {
                    platformsById.get(`relation/${rel.rel}`)?.platformEdges.push(platformEdge);
                }
            }
            
            const platformIdCount = new Map<string, number>();
            for (const node of nodesOfWays.get(properties.id)!) {
                for (const platformId of platformIdByNodeId.get(node) ?? []) {
                    platformIdCount.set(platformId, (platformIdCount.get(platformId) ?? 0) + 1);
                }
            }
            
            for (const [platformId, count] of platformIdCount) {
                if (count >= 2) {
                    platformsById.get(platformId)?.platformEdges.push(platformEdge);
                }
            }
                       
        }
    }


    return {
        stopAreas : [...stopAreasByRelationId.values()],
        nakedStations
    };
}

function isPlatform(tags: {[name : string] : string}) {
    return tags['public_transport'] === 'platform' || tags['railway'] === 'platform' || tags['highway'] === 'platform' || tags['highway'] === 'bus_stop';
}

function isStation(tags: {[name : string] : string}) {
    return tags['public_transport'] === 'station' || tags['railway'] === 'station' || tags['amenity'] === 'bus_station';
}

function isEntrance(tags: {[name : string] : string}) {
    return tags['entrance'] && tags['entrance'] !== 'no' && tags['entrance'] !== 'emergency' 
        || tags['railway'] === 'subway_entrance' 
        || tags['railway'] === 'train_station_entrance' 
        || tags['public_transport'] === 'entrance';
}

function parseWheelchair(tags: {[name : string] : string}) : boolean | undefined {
    if (tags['wheelchair'] === 'yes' || tags['wheelchair'] === 'limited') {
        return true;
    }
    if (tags['wheelchair'] === 'no') {
        return false;
    }
    return undefined;
}

function getId(element : { type : string, id : number }) : string {
    return `${element.type}/${element.id}`;
}