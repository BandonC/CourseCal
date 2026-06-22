import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import type { DeleteResult } from "@/lib/actions/deletes";

// Shared toast handling for the delete actions. Returns whether the delete
// actually happened, so the caller knows to refresh / navigate / drop the row.
// A blocked delete (reconnectNeeded) is a warning with a Reconnect action, not an
// error — nothing was removed and nothing was orphaned (block-and-reconnect).
export function notifyDelete(
  res: ActionResult<DeleteResult>,
  successMessage: string,
  onReconnect: () => void,
): boolean {
  if (!res.ok) {
    toast.error(res.error);
    return false;
  }
  if (res.data.reconnectNeeded) {
    toast.warning("Reconnect Google Calendar to delete this — its events couldn't be removed.", {
      action: { label: "Reconnect", onClick: onReconnect },
    });
    return false;
  }
  toast.success(successMessage);
  return true;
}
