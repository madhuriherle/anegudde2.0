import { useAuth } from '../context/AuthContext';

export const usePermission = () => {
  const { user } = useAuth();

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.is_all_access) return true;
    return user.privileges?.includes(permission);
  };

  return { hasPermission };
};
