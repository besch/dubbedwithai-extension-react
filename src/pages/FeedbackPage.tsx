import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";

const FeedbackPage: React.FC = () => {
  const { t } = useTranslation();

  const formSchema = z.object({
    email: z.string().email({ message: t("invalidEmail") }),
    subject: z.string().min(1, { message: t("subjectRequired") }),
    message: z.string().min(10, { message: t("messageMinLength") }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_API_URL}/api/send-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      if (response.ok) {
        toast.success(t("feedbackSuccess"));
        reset();
      } else {
        throw new Error(t("feedbackError"));
      }
    } catch (error) {
      toast.error(t("feedbackError"));
    }
  };

  return (
    <PageLayout title={t("feedback")}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 max-w-md mx-auto"
      >
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted-foreground"
          >
            {t("email")}
          </label>
          <input
            type="email"
            id="email"
            {...register("email")}
            className="w-full p-2 pl-3 pr-3 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t("emailPlaceholder")}
          />
          {errors.email && (
            <p className="text-red-400 mt-2 text-sm">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-muted-foreground"
          >
            {t("subject")}
          </label>
          <input
            type="text"
            id="subject"
            {...register("subject")}
            className="w-full p-2 pl-3 pr-3 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t("subjectPlaceholder")}
          />
          {errors.subject && (
            <p className="text-red-400 mt-2 text-sm">
              {errors.subject.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-muted-foreground"
          >
            {t("message")}
          </label>
          <textarea
            id="message"
            {...register("message")}
            rows={4}
            className="w-full p-2 pl-3 pr-3 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t("messagePlaceholder")}
          ></textarea>
          {errors.message && (
            <p className="text-red-400 mt-2 text-sm">
              {errors.message.message}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary">
          {t("submitFeedback")}
        </Button>
      </form>
    </PageLayout>
  );
};

export default FeedbackPage;
