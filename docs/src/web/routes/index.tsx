import {Metadata, RouteConfig} from "vatts/react";
import Home from "../components/index";

export const config: RouteConfig = {
    pattern: '/',
    component: Home,
    generateMetadata: (): Metadata => ({
        title: 'Vatts.js | Landing'
    })
};
export default config

