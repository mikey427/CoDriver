import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Commands } from '@/pages/Commands';
import { Dashboard } from '@/pages/Dashboard';
import { Logs } from '@/pages/Logs';
import { Modes } from '@/pages/Modes';
import { Safety } from '@/pages/Safety';
import { Settings } from '@/pages/Settings';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="commands" element={<Commands />} />
        <Route path="logs" element={<Logs />} />
        <Route path="modes" element={<Modes />} />
        <Route path="safety" element={<Safety />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
