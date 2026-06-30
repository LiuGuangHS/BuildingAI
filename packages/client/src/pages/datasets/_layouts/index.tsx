import { Outlet } from "react-router-dom";

import { DatasetsNavbar } from "./navbar";
import { DatasetsSidebar } from "./sidebar";

const KnowledgeLayout = () => {
  return (
    <div className="flex h-full min-h-0">
      <DatasetsSidebar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DatasetsNavbar />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default KnowledgeLayout;
