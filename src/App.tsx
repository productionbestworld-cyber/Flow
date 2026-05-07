import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './lib/AuthContext'
import MainLayout from './layouts/MainLayout'
import ErrorBoundary from './components/shared/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SaleOrder from './pages/SaleOrder'
import Planning from './pages/Planning'
import Extrusion from './pages/Extrusion'
import Printing from './pages/Printing'
import Grinding from './pages/Grinding'
import Warehouse from './pages/Warehouse'
import Sales from './pages/Sales'
import Billing from './pages/Billing'
import Customers from './pages/Customers'
import Products from './pages/Products'
import Settings from './pages/Settings'
import ActivityLog from './pages/ActivityLog'
import WeighingTerminal from './pages/WeighingTerminal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<MainLayout />}>
              <Route index        element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
              <Route path="sale-order" element={<ErrorBoundary><SaleOrder /></ErrorBoundary>} />
              <Route path="planning"   element={<ErrorBoundary><Planning /></ErrorBoundary>} />
              <Route path="extrusion"  element={<ErrorBoundary><Extrusion /></ErrorBoundary>} />
              <Route path="printing"   element={<ErrorBoundary><Printing /></ErrorBoundary>} />
              <Route path="grinding"   element={<ErrorBoundary><Grinding /></ErrorBoundary>} />
              <Route path="warehouse"  element={<ErrorBoundary><Warehouse /></ErrorBoundary>} />
              <Route path="sales"      element={<ErrorBoundary><Sales /></ErrorBoundary>} />
              <Route path="billing"    element={<ErrorBoundary><Billing /></ErrorBoundary>} />
              <Route path="customers"  element={<ErrorBoundary><Customers /></ErrorBoundary>} />
              <Route path="products"   element={<ErrorBoundary><Products /></ErrorBoundary>} />
              <Route path="settings"    element={<ErrorBoundary><Settings /></ErrorBoundary>} />
              <Route path="activity"   element={<ErrorBoundary><ActivityLog /></ErrorBoundary>} />
              <Route path="weighing"   element={<ErrorBoundary><WeighingTerminal /></ErrorBoundary>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
