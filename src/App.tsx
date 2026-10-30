import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/motion';
import { AppShell } from './layout/AppShell';
import Dashboard from './pages/Dashboard';
import Assistant from './pages/Assistant';
import { IngredientsPage, MaterialsPage } from './pages/Supplies';
import { RecipeEditorPage, RecipesPage } from './pages/Recipes';
import OrdersPage from './pages/Orders';
import PurchasesPage from './pages/Purchases';
import CustomersPage from './pages/Customers';
import FinancePage from './pages/Finance';
import OnlineStorePage from './pages/OnlineStore';
import { HistoryPage, OperatingCostsPage, ProductionsPage, SettingsPage, StockPage } from './pages/Operations';

// the public store (with the 3D scene) is loaded only when someone opens /loja
const ShopApp = lazy(() => import('./shop/ShopApp'));

function RecipeEditorRoute() {
  const { id } = useParams();
  return <RecipeEditorPage key={id} />;
}

function Admin() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/assistente" element={<Assistant />} />
        <Route path="/ingredientes" element={<IngredientsPage />} />
        <Route path="/materiais" element={<MaterialsPage />} />
        <Route path="/fichas" element={<RecipesPage />} />
        <Route path="/fichas/:id" element={<RecipeEditorRoute />} />
        <Route path="/compras" element={<PurchasesPage />} />
        <Route path="/producoes" element={<ProductionsPage />} />
        <Route path="/estoque" element={<StockPage />} />
        <Route path="/pedidos" element={<OrdersPage />} />
        <Route path="/clientes" element={<CustomersPage />} />
        <Route path="/financeiro" element={<FinancePage />} />
        <Route path="/loja-online" element={<OnlineStorePage />} />
        <Route path="/custos" element={<OperatingCostsPage />} />
        <Route path="/historico" element={<HistoryPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <StoreProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/loja/*"
                element={
                  <Suspense fallback={<div className="grid min-h-screen place-items-center text-muted">Carregando a loja…</div>}>
                    <ShopApp />
                  </Suspense>
                }
              />
              <Route path="*" element={<Admin />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </StoreProvider>
    </MotionConfig>
  );
}
