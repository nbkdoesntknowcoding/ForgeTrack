import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  return (
    <div className="app-main w-full min-h-screen">
      <Sidebar />
      <div className="md:ml-[260px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 px-8 lg:px-14 xl:px-20 pt-8 pb-24 relative z-10 w-full 2xl:max-w-[1600px] 2xl:mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
