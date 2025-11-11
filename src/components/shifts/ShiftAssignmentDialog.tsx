import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface ShiftAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onShiftAssigned: () => void;
}

export function ShiftAssignmentDialog({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onShiftAssigned,
}: ShiftAssignmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [shiftType, setShiftType] = useState("regular");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!shiftDate || !startTime || !endTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await api.createShift({
        employee_id: employeeId,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        shift_type: shiftType,
        notes: notes || undefined,
        status: "scheduled",
      });

      toast({
        title: "Success",
        description: `Shift assigned to ${employeeName}`,
      });

      // Reset form
      setShiftDate("");
      setStartTime("");
      setEndTime("");
      setNotes("");
      
      onShiftAssigned();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error assigning shift:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign shift",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Shift to {employeeName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time *</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>End Time *</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label>Shift Type</Label>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger>
                <SelectValue placeholder = "Select Shift type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="night">Night</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Assigning...
              </>
            ) : (
              "Assign Shift"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

