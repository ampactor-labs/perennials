import { useEffect } from "react";
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { DataProvider } from "./data/store";
import { SearchProvider } from "./state/search";
import { Layout } from "./components/Layout";
import { BrowsePage } from "./pages/BrowsePage";
import { PlantPage } from "./pages/PlantPage";
import { KeptPage } from "./pages/KeptPage";
import { YardPage } from "./pages/YardPage";
import { YardsPage } from "./pages/YardsPage";
import { AboutPage } from "./pages/AboutPage";

// A new page starts at the top. Going BACK does not: `pathname` changes on a pop
// too, so this used to throw away her place in the list every time she closed a
// plant, which is the loop she is in all day. BrowsePage restores the scroll
// itself on a pop; this just gets out of the way.
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  useEffect(() => {
    if (navigation === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigation]);
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
                <Route path="kept" element={<KeptPage />} />
                <Route path="yards" element={<YardsPage />} />
                <Route path="yard/:id" element={<YardPage />} />
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
