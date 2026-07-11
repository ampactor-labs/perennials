import { useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { CatalogProvider } from "./state/catalog";
import { Layout } from "./components/Layout";
import { CompendiumPage } from "./pages/CompendiumPage";
import { PlantPage } from "./pages/PlantPage";
import { DesignPage } from "./pages/DesignPage";
import { AboutPage } from "./pages/AboutPage";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return <Outlet />;
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <CatalogProvider>
        <Routes>
          <Route element={<ScrollToTop />}>
            <Route element={<Layout />}>
              <Route index element={<CompendiumPage />} />
              <Route path="garden" element={<DesignPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="plant/:id" element={<PlantPage />} />
              <Route path="*" element={<CompendiumPage />} />
            </Route>
          </Route>
        </Routes>
      </CatalogProvider>
    </BrowserRouter>
  );
}
