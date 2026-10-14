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
import { Domains } from './pages/Domains';
import { NewRequest } from './pages/NewRequest';
import { Approvals } from './pages/Approvals';
import { AttackLab } from './pages/AttackLab';
import { Recovery } from './pages/Recovery';
import { Guardians } from './pages/Guardians';
import { Activity } from './pages/Activity';
import { Security } from './pages/Security';
import { NotFound } from './pages/Placeholders';

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
                <Route path="/domains" element={<Domains />} />
                <Route path="/new-request" element={<NewRequest />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route path="/attack-lab" element={<AttackLab />} />
                <Route path="/recovery" element={<Recovery />} />
                <Route path="/guardians" element={<Guardians />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/security" element={<Security />} />
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
