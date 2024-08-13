import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "react-toastify";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  subject: z.string().min(1, { message: "Subject is required" }),
  message: z
    .string()
    .min(10, { message: "Message must be at least 10 characters" }),
});

const FeedbackPage: React.FC = () => {
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
        toast.success("Thank you for your feedback!");
        reset();
      } else {
        throw new Error("Failed to submit feedback");
      }
    } catch (error) {
      toast.error("Failed to submit feedback. Please try again.");
    }
  };

  return (
    <PageLayout title="Feedback">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 max-w-md mx-auto"
      >
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-muted-foreground"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            {...register("email")}
            className="w-full p-2 pl-3 pr-3 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="your@email.com"
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
            Subject
          </label>
          <input
            type="text"
            id="subject"
            {...register("subject")}
            className="w-full p-2 pl-3 pr-3 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Bug report or feature request"
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
            Message
          </label>
          <textarea
            id="message"
            {...register("message")}
            rows={4}
            className="w-full p-2 pl-3 pr-3 border rounded bg-input text-foreground border-border placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Describe the bug or feature request in detail"
          ></textarea>
          {errors.message && (
            <p className="text-red-400 mt-2 text-sm">
              {errors.message.message}
            </p>
          )}
        </div>

        <Button type="submit" variant="primary">
          Submit Feedback
        </Button>
      </form>
    </PageLayout>
  );
};

export default FeedbackPage;
