"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/client"
import { ActivityLog } from "@/components/team/activity-log"

export default function TeamManagementPage() {
  const utils = trpc.useUtils()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: members, isLoading: loadingMembers } = (trpc.team.listMembers as any).useQuery()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listInvitationsQuery = (trpc.team.listInvitations as any).useQuery()
  const { data: invitations, isLoading: loadingInvitations } = listInvitationsQuery

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inviteMutation = (trpc.team.invite as any).useMutation({
    onSuccess: () => {
      utils.team.listInvitations.invalidate()
      setInviteEmail("")
      setInviteRole("VIEWER")
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateRoleMutation = (trpc.team.updateRole as any).useMutation({
    onSuccess: () => utils.team.listMembers.invalidate(),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const removeMemberMutation = (trpc.team.removeMember as any).useMutation({
    onSuccess: () => utils.team.listMembers.invalidate(),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const revokeInvitationMutation = (trpc.team.revokeInvitation as any).useMutation({
    onSuccess: () => utils.team.listInvitations.invalidate(),
  })

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "JOB_POSTER" | "VIEWER">("VIEWER")

  if (loadingMembers || loadingInvitations) {
    return (
      <div data-testid="team-loading-skeleton">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-64 w-full animate-pulse rounded bg-gray-200" />
      </div>
    )
  }

  const memberList = (members ?? []) as MemberItem[]
  const invitationList = (invitations ?? []) as InvitationItem[]

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Team Management</h1>

      {/* Invite Form */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Invite Team Member</h2>
        <form
          data-testid="invite-form"
          onSubmit={(e) => {
            e.preventDefault()
            inviteMutation.mutate({ email: inviteEmail, role: inviteRole })
          }}
          className="flex items-end gap-3"
        >
          <div className="flex-1">
            <label htmlFor="invite-email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              placeholder="colleague@company.com"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "ADMIN" | "JOB_POSTER" | "VIEWER")}
              className="mt-1 rounded border px-3 py-2 text-sm"
            >
              <option value="VIEWER">Viewer</option>
              <option value="JOB_POSTER">Job Poster</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={inviteMutation.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {inviteMutation.isPending ? "Sending..." : "Send Invite"}
          </button>
        </form>
        {inviteMutation.error && (
          <p className="mt-2 text-sm text-red-600">{inviteMutation.error.message}</p>
        )}
      </section>

      {/* Members List */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Team Members</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="members-table">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Role</th>
                <th className="pb-2 pr-4">Joined</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {memberList.map((member) => (
                <tr key={member.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">{member.clerkUserId}</td>
                  <td className="py-3 pr-4">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          memberId: member.id,
                          role: e.target.value as "ADMIN" | "JOB_POSTER" | "VIEWER",
                        })
                      }
                      className="rounded border px-2 py-1 text-sm"
                      data-testid={`role-select-${member.id}`}
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="JOB_POSTER">Job Poster</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td className="py-3 pr-4 text-gray-500">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => removeMemberMutation.mutate({ memberId: member.id })}
                      disabled={removeMemberMutation.isPending}
                      className="text-sm text-red-600 hover:underline disabled:opacity-50"
                      data-testid={`remove-member-${member.id}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending Invitations */}
      {invitationList.length > 0 && (
        <section className="rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Pending Invitations</h2>
          <ul className="divide-y" data-testid="invitations-list">
            {invitationList.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="text-sm font-medium">{inv.email}</span>
                  <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">{inv.role}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => revokeInvitationMutation.mutate({ invitationId: inv.id })}
                  disabled={revokeInvitationMutation.isPending}
                  className="text-sm text-red-600 hover:underline disabled:opacity-50"
                  data-testid={`revoke-invitation-${inv.id}`}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Activity Log */}
      <section className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Activity Log</h2>
        <ActivityLog />
      </section>
    </div>
  )
}

interface MemberItem {
  id: string
  clerkUserId: string
  role: "ADMIN" | "JOB_POSTER" | "VIEWER"
  joinedAt: string
}

interface InvitationItem {
  id: string
  email: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
}
