import {Metadata, RouteConfig} from "vatts/react";
import Home from "../components/docs";

export const config: RouteConfig = {
    pattern: '/docs/[[value]]/[[value2]]',
    component: Home,
    generateMetadata: (): Metadata => ({
        title: 'Vatts.js | Docs'
    })
};
export default config
