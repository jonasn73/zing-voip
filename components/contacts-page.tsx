"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Search,
  Plus,
  Phone,
  MoreVertical,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { fetcher, fetchJson } from "@/lib/fetcher"
import type { Receptionist } from "@/lib/types"

export function ContactsPage() {
  const { data, mutate } = useSWR<{ data: Receptionist[] }>("/api/receptionists", fetcher)
  const contacts = (data?.data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    initials: r.initials,
    color: r.color,
    active: r.is_active,
    priority: false,
  }))
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [priorityLocal, setPriorityLocal] = useState<Record<string, boolean>>({})

  const filtered = contacts
    .map((c) => ({ ...c, priority: priorityLocal[c.id] ?? c.priority }))
    .filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    )

  const activeCount = contacts.filter((c) => c.active).length

  async function toggleContact(id: string) {
    const next = !contacts.find((c) => c.id === id)?.active
    await fetchJson(`/api/receptionists/${id}`, { method: "PATCH", body: { is_active: next } })
    mutate()
  }

  function togglePriority(id: string) {
    setPriorityLocal((p) => ({ ...p, [id]: !p[id] }))
  }

  async function removeContact(id: string) {
    await fetchJson(`/api/receptionists/${id}`, { method: "DELETE" })
    mutate()
  }

  async function addContact() {
    if (!newName.trim() || !newPhone.trim()) return
    await fetchJson("/api/receptionists", { method: "POST", body: { name: newName.trim(), phone: newPhone.trim() } })
    setNewName("")
    setNewPhone("")
    setShowAddDialog(false)
    mutate()
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Contacts</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount} of {contacts.length} receiving calls
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border-border bg-card pl-9 text-foreground placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setContacts((prev) => prev.map((c) => ({ ...c, active: true })))
          }
          className="text-xs border-border bg-card text-foreground hover:bg-secondary hover:text-secondary-foreground"
        >
          Enable All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setContacts((prev) => prev.map((c) => ({ ...c, active: false })))
          }
          className="text-xs border-border bg-card text-foreground hover:bg-secondary hover:text-secondary-foreground"
        >
          Disable All
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.map((contact) => (
          <div
            key={contact.id}
            className={cn(
              "flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all",
              contact.active && "border-primary/30 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-11 w-11">
                  <AvatarFallback
                    className={cn(
                      contact.color,
                      "text-primary-foreground text-xs font-semibold"
                    )}
                  >
                    {contact.initials}
                  </AvatarFallback>
                </Avatar>
                {contact.active && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {contact.name}
                  </p>
                  {contact.priority && (
                    <Star className="h-3 w-3 fill-warning text-warning" />
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {contact.phone}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={contact.active}
                onCheckedChange={() => toggleContact(contact.id)}
                aria-label={`Route calls to ${contact.name}`}
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Options for ${contact.name}`}>
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                  <DropdownMenuItem onClick={() => togglePriority(contact.id)} className="gap-2 text-foreground focus:bg-secondary focus:text-secondary-foreground">
                    <Star className="h-4 w-4" />
                    {contact.priority ? "Remove Priority" : "Set Priority"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => removeContact(contact.id)} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Search className="h-8 w-8" />
            <p className="text-sm">No contacts found</p>
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Add Contact</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a team member to receive forwarded calls.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name" className="text-foreground">Name</Label>
              <Input
                id="name"
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="border-border bg-secondary text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone" className="text-foreground">Phone Number</Label>
              <Input
                id="phone"
                placeholder="(555) 000-0000"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="border-border bg-secondary text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <Button onClick={addContact} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
              Add Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
