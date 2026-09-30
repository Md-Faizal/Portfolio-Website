import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Admin from './pages/Admin/Admin';
import PasscodeModal from './components/common/PasscodeModal';
import './admin.css';

function StandaloneAdminApp() {
  // Check if PIN 2004 (or valid) was already entered
  const [authenticated, setAuthenticated] = useState(() => {
    const saved = localStorage.getItem('faizal_admin_pin');
    return saved === '2004';
  });

  const handleSuccess = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('faizal_admin_pin');
    setAuthenticated(false);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        <PasscodeModal
          isOpen={true}
          onClose={() => {
            window.location.href = '/';
          }}
          onSuccess={handleSuccess}
        />
      </div>
    );
  }

  return <Admin onExit={handleLogout} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StandaloneAdminApp />
  </React.StrictMode>
);
