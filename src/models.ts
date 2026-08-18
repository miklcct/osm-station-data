export class StopArea {
    atcoCode?: string | undefined;
    stations: Station[] = [];
    platforms: Platform[] = [];
    entrances: Entrance[] = [];
}

export class Station {
    atcoCode?: string | undefined;
    name?: string | undefined;
    crsCode?: string | undefined;
    wheelchair?: boolean | undefined;
    geojson: any;
}

export class Platform {
    atcoCode?: string | undefined;
    stop_code?: string | undefined;
    wheelchair?: boolean | undefined;
    geojson: any;
    platformEdges: PlatformEdge[] = [];
}

export class PlatformEdge {
    stop_code?: string | undefined;
    atcoCode?: string | undefined;
    wheelchair?: boolean | undefined;
    geojson: any;
}

export class Entrance {
    atcoCode?: string | undefined;
    name?: string | undefined;
    stop_code?: string | undefined;
    wheelchair?: boolean | undefined;
    geojson: any;
}

export interface StationsInfo {
    stopAreas: StopArea[];
    nakedStations: Station[];
}