import React from 'react';
import { AgStudio, AgStudioProvider } from 'ag-studio-react';
import { AgStudioAiModule } from 'ag-studio';

export default function StudioShell({ licenseKey, data, mode = 'edit' }) {
  return (
    <AgStudioProvider
      licenseKey={licenseKey}
      modules={[AgStudioAiModule]}
    >
      <main className="studio-container" role="main">
        <AgStudio
          data={data}
          mode={mode}
          style={{ width: '100%', height: '100%' }}
        />
      </main>
    </AgStudioProvider>
  );
}

