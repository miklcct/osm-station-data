import {fetchStationData, Station} from './index.ts';
import 'leaflet/dist/leaflet.css';
import L, {Layer} from 'leaflet';
import pointOnFeature from '@turf/point-on-feature';

async function init() {
    const map = L.map('map').setView([51.5073, -0.1277], 15); // Charing Cross
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 20, maxNativeZoom: 19, attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);

    console.log('Fetching Data...');
    const data = await fetchStationData(undefined, import.meta.env.VITE_OVERPASS_URL);
    console.log('Data fetched!', data);

    const stationMarkers : Layer[] = [];
    const stationDetails : Layer[] = [];

    function registerLayer(marker : Layer, minZoom : number) {
        map.on('zoomstart', () => {
            marker.remove();
        })
        map.on('zoomend', () =>  {
            if (map.getZoom() >= minZoom) {
                marker.addTo(map);
            }
        });
        if (map.getZoom() >= minZoom) {
            marker.addTo(map);
        }
    }
    
    function processStation(station: Station, colour: string | undefined) {
        try {
            if (station.geojson.geometry.type !== 'Point') {
                stationDetails.push(L.geoJSON(station.geojson, {style: {color: colour}}));
            }

            // C. Use the helper function to get a point and place a marker
            const pointFeature = pointOnFeature(station.geojson);
            const [lng, lat] = pointFeature.geometry.coordinates;

            stationMarkers.push(L.circleMarker([lat, lng], {
                radius: 10,        // The radius in pixels (1.5px radius = 3px diameter)
                color: 'black',       // The color of the stroke/border
                weight: 1,          // Set to 0 to remove the border entirely
                fillColor: colour,   // The fill color inside the dot
                fillOpacity: 1      // Set to 1 for a solid, non-transparent dot
            })
                .bindPopup(`<b>${station.name ?? ''}</b><br>CRS: ${station.crsCode ?? ''}<br>ATCO: ${station.atcoCode ?? ''}`));
        } catch (e) {
            console.log(e);
        }
    }

    for (const station of data.nakedStations) {
        processStation(station, 'red');
    }

    for (const stopArea of data.stopAreas) {
        for (const station of stopArea.stations) {
            processStation(station, 'blue');

        }
        
        for (const platform of stopArea.platforms) {
            try {
                stationDetails.push(L.geoJSON(platform.geojson, {style: {color: 'red'}})
                    .bindPopup(`<b>Platform ${platform.stop_code ?? ''}</b><br>ATCO: ${platform.atcoCode ?? ''}`));
            } catch (e) {
                console.log(e);
            }
            
            for (const platformEdge of platform.platformEdges) {
                try {
                    stationDetails.push(L.geoJSON(platformEdge.geojson, {style: {color: 'purple'}})
                        .bindPopup(`<b>Platform ${platformEdge.stop_code ?? ''}</b><br>ATCO: ${platformEdge.atcoCode ?? ''}`));
                } catch (e) {
                    console.log(e);
                }
            }
        }
        
        for (const entrance of stopArea.entrances) {
            try {
                const [lng, lat] = pointOnFeature(entrance.geojson).geometry.coordinates;
                // Create the circle marker
                stationDetails.push(L.circleMarker([lat, lng], {
                    radius: 5,        // The radius in pixels (1.5px radius = 3px diameter)
                    color: 'black',       // The color of the stroke/border
                    weight: 1,          // Set to 0 to remove the border entirely
                    fillColor: 'green',   // The fill color inside the dot
                    fillOpacity: 1      // Set to 1 for a solid, non-transparent dot
                })
                    .bindPopup(`<b>Exit ${entrance.stop_code ?? ''} ${entrance.name ?? ''}</b><br>ATCO: ${entrance.atcoCode ?? ''}`));
            } catch (e) {
                console.log(e);
            }
        }
        
        registerLayer(L.layerGroup(stationDetails), 15);
        registerLayer(L.layerGroup(stationMarkers), 12);
    }
}

init();