import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import AgentCatalog from "./pages/AgentCatalog";
import AgentDetail from "./pages/AgentDetail";
import Playground from "./pages/Playground";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/agents" element={<AgentCatalog />} />
        <Route path="/agents/:slug" element={<AgentDetail />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/playground/:slug" element={<Playground />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}
