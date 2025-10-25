import { useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

interface ContactLandlordDialogProps {
  propertyId: string;
  landlordId: string;
  propertyName?: string;
  trigger: ReactNode;
}

const ContactLandlordDialog = ({
  propertyId,
  landlordId,
  propertyName,
  trigger,
}: ContactLandlordDialogProps) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const trimmedMessage = message.trim();
  const isValid = trimmedMessage.length >= 1 && trimmedMessage.length <= 500;
  const remainingChars = 500 - trimmedMessage.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to send messages.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Insert message
      const payload: Database["public"]["Tables"]["messages"]["Insert"] = {
        property_id: propertyId,
        landlord_id: landlordId,
        sender_id: user.id,
        message: trimmedMessage,
      };

      const { error: insertError } = await supabase
        .from("messages")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        // Handle RLS policy error
        if (insertError.code === "42501") {
          toast({
            title: "Permission denied",
            description: "You don't have permission to send this message.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Failed to send message",
            description: "An error occurred. Please try again later.",
            variant: "destructive",
          });
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      toast({
        title: "Message sent",
        description: "The landlord will receive your message.",
      });

      // Reset and close
      setMessage("");
      setOpen(false);
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      setOpen(newOpen);
      if (!newOpen) {
        // Reset form when closing
        setMessage("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Contact Landlord</DialogTitle>
            <DialogDescription>
              {propertyName
                ? `Send a message about ${propertyName}`
                : "Send a message to the property landlord"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Your message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="I'm interested in this property..."
                maxLength={500}
                rows={5}
                disabled={isSubmitting}
                aria-invalid={!isValid && trimmedMessage.length > 0}
                required
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {trimmedMessage.length < 1 && "Message is required"}
                  {trimmedMessage.length > 500 && "Message is too long"}
                </span>
                <span className={remainingChars < 0 ? "text-destructive" : ""}>
                  {remainingChars} characters remaining
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? "Sending..." : "Send message"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactLandlordDialog;
