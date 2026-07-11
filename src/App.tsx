import { useEffect } from "react";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { DataProvider } from "./data/store";
import { SearchProvider } from "./state/search";
import { Layout } from "./components/Layout";
import { BrowsePage } from "./pages/BrowsePage";
import { PlantPage } from "./pages/PlantPage";
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
    <DataProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <SearchProvider>
          <Routes>
            <Route element={<ScrollToTop />}>
              <Route element={<Layout />}>
                <Route index element={<BrowsePage />} />
                <Route path="plant/:slug" element={<PlantPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="*" element={<BrowsePage />} />
              </Route>
            </Route>
          </Routes>
        </SearchProvider>
      </BrowserRouter>
    </DataProvider>
  );
}
