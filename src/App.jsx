// src/App.jsx
import React, { useState } from 'react'
import { AppProvider } from './context/AppContext'
import TableScreen from './screens/TableScreen'
import MenuScreen from './screens/MenuScreen'
import OrderScreen from './screens/OrderScreen'
import ReportsScreen from './screens/ReportsScreen'
import SettingsScreen from './screens/SettingsScreen'
import SyncScreen from './screens/SyncScreen'
import MenuManagerScreen from './screens/MenuManagerScreen'

export default function App() {
  const [route, setRoute] = useState({ name: 'tables', params: {} })

  const navigate = (name, params = {}) => {
    setRoute({ name, params })
  }

  const renderScreen = () => {
    switch (route.name) {
      case 'tables':
        return <TableScreen onNavigate={navigate} />
      case 'menu':
        return <MenuScreen {...route.params} onNavigate={navigate} key={JSON.stringify(route.params)} />
      case 'order':
        return <OrderScreen {...route.params} onNavigate={navigate} />
      case 'reports':
        return <ReportsScreen onNavigate={navigate} />
      case 'settings':
        return <SettingsScreen onNavigate={navigate} />
      case 'sync':
        return <SyncScreen onNavigate={navigate} />
      case 'menuManager':
        return <MenuManagerScreen onNavigate={navigate} />
      default:
        return <TableScreen onNavigate={navigate} />
    }
  }

  return (
    <AppProvider>
      <div style={{ height: '100%', maxWidth: 1400, margin: '0 auto', position: 'relative' }}>
        {renderScreen()}
      </div>
    </AppProvider>
  )
}
