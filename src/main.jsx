import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/base.css'
import './styles/home.css'
import './styles/board.css'
import './styles/cards.css'
import './styles/panels.css'
import './styles/fx.css'

createRoot(document.getElementById('root')).render(<App />)