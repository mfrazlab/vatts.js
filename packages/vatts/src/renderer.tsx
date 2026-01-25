/*
 * This file is part of the Vatts.js Project.
 * Copyright (c) 2026 itsmuzin
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { RouteConfig, Metadata } from './types';
import type { GenericRequest, GenericResponse } from './types/framework';
import {cachedFramework} from "./api/framework";
import {render} from "./react/renderer-react";
import {renderVue} from "./vue/renderer.vue";


// --- Renderização Principal ---

interface RenderOptions {
    req: GenericRequest;
    res: any; // Raw response object (ServerResponse)
    route: RouteConfig & { componentPath: string };
    params: Record<string, string>;
    allRoutes: (RouteConfig & { componentPath: string })[];
}

export async function renderAsStream(params: RenderOptions): Promise<void> {
    if(cachedFramework === 'react') {
        return await render(params)
    } else {
        return await renderVue(params)
    }
}


