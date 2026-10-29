/* Copyright (c) Microsoft Corporation. All rights reserved. */
/* Licensed under the MIT License. See LICENSE.txt in the project root for license information. */
import { createRoot } from 'react-dom/client';
import { AgentClient } from '@morcherlf/agent-client-core';
import { App } from './App';
import { desktopRuntime } from './runtime';

createRoot(document.getElementById('root')!).render(<App client={new AgentClient()} runtime={desktopRuntime}/>);
