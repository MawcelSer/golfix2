import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SendReminderDialog } from "../SendReminderDialog";
import { useToastStore } from "@/stores/toast-store";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

afterEach(() => {
  cleanup();
  useToastStore.getState().toasts = [];
  vi.restoreAllMocks();
});

describe("SendReminderDialog", () => {
  const defaultProps = {
    courseId: "course-1",
    groupId: "group-1",
    groupNumber: 3,
    onClose: vi.fn(),
  };

  it("renders dialog with group number", () => {
    render(<SendReminderDialog {...defaultProps} />);
    expect(screen.getByTestId("reminder-dialog")).toBeInTheDocument();
    expect(screen.getByText(/Groupe 3/)).toBeInTheDocument();
  });

  it("calls API and shows success toast on send", async () => {
    const user = userEvent.setup();
    const { apiClient } = await import("@/services/api-client");
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      sent: true,
      recipientCount: 2,
    });

    render(<SendReminderDialog {...defaultProps} />);

    await user.click(screen.getByTestId("reminder-send-btn"));

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    expect(apiClient.post).toHaveBeenCalledWith("/courses/course-1/reminders/group-1", {});
  });

  it("sends optional message in body", async () => {
    const user = userEvent.setup();
    const { apiClient } = await import("@/services/api-client");
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      sent: true,
      recipientCount: 1,
    });

    render(<SendReminderDialog {...defaultProps} />);

    await user.type(screen.getByTestId("reminder-message"), "Accelerez SVP");
    await user.click(screen.getByTestId("reminder-send-btn"));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/courses/course-1/reminders/group-1", {
        message: "Accelerez SVP",
      });
    });
  });

  it("shows error toast on failure", async () => {
    const user = userEvent.setup();
    const { apiClient, ApiError } = await import("@/services/api-client");
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValue(new ApiError("Not found", 404));

    render(<SendReminderDialog {...defaultProps} />);
    await user.click(screen.getByTestId("reminder-send-btn"));

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.type === "error")).toBe(true);
    });
  });

  it("closes on cancel", async () => {
    const user = userEvent.setup();
    render(<SendReminderDialog {...defaultProps} />);

    await user.click(screen.getByText("Annuler"));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
