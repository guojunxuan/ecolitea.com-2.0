import React from 'react'
import { renderToString } from 'react-dom/server'
import { Fixture } from './fixture'
export const html=renderToString(<Fixture/>)
