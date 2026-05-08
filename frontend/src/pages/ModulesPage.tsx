import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  UtensilsCrossed, 
  Briefcase, 
  Users, 
  BarChart3, 
  Settings 
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';

const modules = [
  { id: 'home', title: 'Home', icon: Home, path: '/', color: 'text-primary', bg: 'bg-primary/10' },
  { id: 'canteen', title: 'Canteen', icon: UtensilsCrossed, path: '/canteen', color: 'text-secondary', bg: 'bg-secondary/10' },
  { id: 'office', title: 'Office', icon: Briefcase, path: '/office', color: 'text-secondary-light', bg: 'bg-secondary-light/10' },
  { id: 'users', title: 'Users', icon: Users, path: '/users', color: 'text-primary', bg: 'bg-primary/10' },
  { id: 'reports', title: 'Reports', icon: BarChart3, path: '/reports', color: 'text-secondary', bg: 'bg-secondary/10' },
  { id: 'settings', title: 'Master Settings', icon: Settings, path: '/settings/categories', color: 'text-secondary-dark', bg: 'bg-secondary-dark/10' },
];

const ModulesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      <div className="text-center space-y-3">
        <h1 className="text-2xl font-bold text-secondary font-serif" style={{ fontSize: '24px' }}>Anegudde Inventory Management System (AIMS)</h1>
        <div className="w-24 h-1 bg-primary mx-auto rounded-full"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {modules.map((module) => (
          <button
            key={module.id}
            onClick={() => navigate(module.path)}
            className="group focus:outline-none"
          >
            <Card className="h-full border-border-temple hover:border-primary/50 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-white/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center p-10 space-y-6">
                <div className={`p-6 rounded-3xl ${module.bg} ${module.color} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-sm`}>
                  <module.icon className="w-12 h-12" />
                </div>
                <div className="text-center space-y-1.5">
                  <h3 className="text-lg font-bold text-secondary font-serif" style={{ fontSize: '16px' }}>{module.title}</h3>
                  <p className="text-[11px] text-text-light font-medium">Access {module.title} module</p>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ModulesPage;
