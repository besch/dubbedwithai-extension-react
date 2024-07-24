import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login } from "@/store/authSlice";
import { AppDispatch, RootState } from "@/store";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";
import { toast } from "react-toastify";

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const handleLogin = async () => {
    try {
      await dispatch(login()).unwrap();
      navigate("/search");
      toast.success("Logged in successfully");
    } catch (error) {
      console.error("Login failed:", error);
      toast.error("Login failed. Please try again.");
    }
  };

  return (
    <PageLayout title="Welcome to OneDub">
      <div className="text-center">
        <p className="mb-4 text-gray-600">
          Please log in to access the movie dubbing features.
        </p>
        <Button onClick={handleLogin} disabled={loading}>
          {loading ? "Logging in..." : "Login with Google"}
        </Button>
      </div>
    </PageLayout>
  );
};

export default AuthPage;
