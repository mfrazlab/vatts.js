import {RouteConfig, router} from "vatts/react";
import {GuestOnly, useSession} from "@vatts/auth/react"
import React, {useState} from "react";
import LoginPage from "../components/LoginPage";



const wrapper = () => {
    const session = useSession()
    if (session.status === 'loading') {
        return <div>Loading...</div>;
    }
    if (session.status === 'authenticated') {
        router.push('/')
        return <div>Redirecting...</div>;
    }

    return (
        <LoginPage/>
    )
}

export const config = {
    pattern: '/login',
    component: wrapper,
    generateMetadata: () => ({
        title: 'Vatts | Login'
    })
};
export default config
