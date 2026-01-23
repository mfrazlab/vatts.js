import {RouteConfig} from "vatts/react";
import Home from "../components/Home";


export const config = {
    pattern: '/',
    component: Home,
    generateMetadata: () => ({
        title: 'Vatts | Home'
    })
};
export default config
