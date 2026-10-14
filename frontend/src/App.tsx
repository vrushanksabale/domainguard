import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Web3Provider } from './context/Web3Context';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Navbar } from './components/Navbar';
import { ReceiptStrip } from './components/ReceiptStrip';
import { Toast } from './components/Toast';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import {
  DomainsPlaceholder,
  NewRequestPlaceholder,
  ApprovalsPlaceholder,
  AttackLabPlaceholder,
  RecoveryPlaceholder,
  GuardiansPlaceholder,
  ActivityPlaceholder,
  SecurityPlaceholder,
  NotFound,
} from './pages/Placeholders';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Web3Provider>
          <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
            <AnnouncementBar />
            <Navbar />
            <ReceiptStrip />
            <main className="flex-grow">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/domains" element={<DomainsPlaceholder />} />
                <Route path="/new-request" element={<NewRequestPlaceholder />} />
                <Route path="/approvals" element={<ApprovalsPlaceholder />} />
                <Route path="/attack-lab" element={<AttackLabPlaceholder />} />
                <Route path="/recovery" element={<RecoveryPlaceholder />} />
                <Route path="/guardians" element={<GuardiansPlaceholder />} />
                <Route path="/activity" element={<ActivityPlaceholder />} />
                <Route path="/security" element={<SecurityPlaceholder />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Toast />
          </div>
        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
