import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./Landing";
import VaultView from "./components/vault/Vault";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Landing/>
          }
        />
        <Route
          path="/vault"
          element={
            <VaultView />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
