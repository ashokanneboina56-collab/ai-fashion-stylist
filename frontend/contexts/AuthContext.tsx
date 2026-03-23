import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type User = {
  user_id: string;
  name: string;
  email: string;
  profile_image?: string | null;
  profile_complete?: boolean;
  gender?: string | null;
  dress_preference?: string | null;
  top_size?: string | null;
  bottom_size?: string | null;
  shoe_size?: string | null;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  updateUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  updateUser: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      console.log('Starting loadAuth...');
      const savedToken = await AsyncStorage.getItem('auth_token');
      const savedUser = await AsyncStorage.getItem('auth_user');
      console.log('loadAuth data retrieved:', !!savedToken, !!savedUser);
      
      if (savedToken && savedUser) {
        try {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } catch (parseError) {
          console.error('Error parsing saved user:', parseError);
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('auth_user');
        }
      }
    } catch (e) {
      console.error('loadAuth failed:', e);
    } finally {
      console.log('loadAuth finishing, setting isLoading to false');
      setIsLoading(false);
    }
  };

  const login = async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem('auth_token', newToken);
    await AsyncStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = async (updatedUser: User) => {
    await AsyncStorage.setItem('auth_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
