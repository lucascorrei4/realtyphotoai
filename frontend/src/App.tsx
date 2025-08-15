import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ImageEnhancement from './pages/ImageEnhancement';
import InteriorDesign from './pages/InteriorDesign';
import ReplaceElements from './pages/ReplaceElements';
import Users from './pages/Users';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/image-enhancement" element={<ImageEnhancement />} />
            <Route path="/interior-design" element={<InteriorDesign />} />
            <Route path="/replace-elements" element={<ReplaceElements />} />
            <Route path="/users" element={<Users />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
