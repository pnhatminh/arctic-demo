import { BrowserRouter, Route, Routes } from "react-router-dom";
import Landing from "./Landing";

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
          path="/vault/"
          element={
            <>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
