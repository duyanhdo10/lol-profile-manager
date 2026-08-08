import { Center, Loader } from '@mantine/core';
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './AppLayout';

const OverviewPage = lazy(() =>
  import('../pages/OverviewPage').then((module) => ({ default: module.OverviewPage })),
);
const IconsPage = lazy(() => import('../pages/IconsPage').then((module) => ({ default: module.IconsPage })));
const BackgroundsPage = lazy(() =>
  import('../pages/BackgroundsPage').then((module) => ({ default: module.BackgroundsPage })),
);
const ShowcasePage = lazy(() =>
  import('../pages/ShowcasePage').then((module) => ({ default: module.ShowcasePage })),
);
const PresencePage = lazy(() =>
  import('../pages/PresencePage').then((module) => ({ default: module.PresencePage })),
);

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <Center h="100vh">
          <Loader />
        </Center>
      }
    >
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="icons" element={<IconsPage />} />
          <Route path="backgrounds" element={<BackgroundsPage />} />
          <Route path="showcase/:tab?" element={<ShowcasePage />} />
          <Route path="presence" element={<PresencePage />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
