declare module '@derhuerst/query-overpass' {
    import {OperationOptions} from "retry";

    export interface Element {
        type: string;
        id: number;
        tags?: { [name: string]: string } | undefined;
        timestamp?: string | undefined;
        version?: number | undefined;
        changeset?: number | undefined;
        user?: string | undefined;
        uid?: number | undefined;
    }

    export interface Node extends Element {
        lat: number;
        lon: number;
    }

    export interface Way extends Element {
        nodes: number[];
    }

    export interface Relationship extends Element {
        members: Member[];
    }

    export interface Member {
        type: string;
        ref: number;
        role: string;
    }
    export default function queryOverpass(query: string, opt: {fetchMode?: RequestInit, endpoint?: string, retryOpts?: OperationOptions} = {}): Promise<Element[]>;
}