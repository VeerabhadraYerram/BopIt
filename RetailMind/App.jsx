import { AgStudioAiModule } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";

function App() {
    return (
        <AgStudioProvider
            licenseKey={import.meta.env.VITE_AG_STUDIO_LICENSE_KEY}
            modules={[AgStudioAiModule]}
        >
            <div style={{ width: "100%", height: "100vh" }}>
                <AgStudio />
            </div>
        </AgStudioProvider>
    );
}

export default App;