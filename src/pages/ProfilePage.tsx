// src/pages/ProfilePage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!user) {
    return <div>Loading user information...</div>;
  }

  return (
    <PageLayout title="Profile">
      <div className="flex items-center mb-6">
        <img
          src={user.picture}
          alt={`${user.name}'s profile`}
          className="w-16 h-16 rounded-full mr-4"
        />
        <div>
          <p className="font-semibold text-lg">{user.name}</p>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>
      <Button onClick={handleLogout} variant="outline">
        Logout
      </Button>
    </PageLayout>
  );
};

export default ProfilePage;
