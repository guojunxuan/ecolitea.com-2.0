import React from 'react'
import { hydrateRoot } from 'react-dom/client'
import { Fixture } from './fixture'
hydrateRoot(document.getElementById('fixture')!, <Fixture/>)
