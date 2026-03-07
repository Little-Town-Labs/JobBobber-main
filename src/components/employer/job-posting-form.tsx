"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc/client"

interface PostingData {
  id: string
  title: string
  department: string | null
  description: string
  responsibilities: string | null
  requiredSkills: string[]
  preferredSkills: string[]
  experienceLevel: string
  employmentType: string
  locationType: string
  locationReq: string | null
  salaryMin: number | null
  salaryMax: number | null
  benefits: string[]
  whyApply: string | null
}

interface JobPostingFormProps {
  posting: PostingData | null
}

function validate(
  title: string,
  description: string,
  salaryMin: string,
  salaryMax: string,
): string | null {
  if (!title.trim()) return "Title is required."
  if (!description.trim()) return "Description is required."
  const min = salaryMin ? parseInt(salaryMin, 10) : null
  const max = salaryMax ? parseInt(salaryMax, 10) : null
  if (min !== null && max !== null && max < min) {
    return "Maximum salary must be greater than or equal to minimum salary."
  }
  return null
}

export function JobPostingForm({ posting }: JobPostingFormProps) {
  const router = useRouter()
  const isEditing = posting !== null

  const [title, setTitle] = useState(posting?.title ?? "")
  const [department, setDepartment] = useState(posting?.department ?? "")
  const [description, setDescription] = useState(posting?.description ?? "")
  const [responsibilities, setResponsibilities] = useState(posting?.responsibilities ?? "")
  const [requiredSkills, setRequiredSkills] = useState<string[]>(posting?.requiredSkills ?? [])
  const [preferredSkills] = useState<string[]>(posting?.preferredSkills ?? [])
  const [experienceLevel, setExperienceLevel] = useState(posting?.experienceLevel ?? "MID")
  const [employmentType, setEmploymentType] = useState(posting?.employmentType ?? "FULL_TIME")
  const [locationType, setLocationType] = useState(posting?.locationType ?? "REMOTE")
  const [locationReq, setLocationReq] = useState(posting?.locationReq ?? "")
  const [salaryMin, setSalaryMin] = useState(posting?.salaryMin?.toString() ?? "")
  const [salaryMax, setSalaryMax] = useState(posting?.salaryMax?.toString() ?? "")
  const [whyApply, setWhyApply] = useState(posting?.whyApply ?? "")
  const [skillInput, setSkillInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const createPosting = trpc.jobPostings.create.useMutation()
  const updatePosting = trpc.jobPostings.update.useMutation()
  const mutation = isEditing ? updatePosting : createPosting

  function handleAddSkill(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      const skill = skillInput.trim()
      if (skill && !requiredSkills.includes(skill)) {
        setRequiredSkills([...requiredSkills, skill])
        setSkillInput("")
      }
    }
  }

  function handleRemoveSkill(skill: string) {
    setRequiredSkills(requiredSkills.filter((s) => s !== skill))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const validationError = validate(title, description, salaryMin, salaryMax)
    if (validationError) {
      setError(validationError)
      return
    }

    const data = {
      title,
      department: department || undefined,
      description,
      responsibilities: responsibilities || undefined,
      requiredSkills,
      preferredSkills,
      experienceLevel: experienceLevel as "ENTRY" | "MID" | "SENIOR" | "EXECUTIVE",
      employmentType: employmentType as "FULL_TIME" | "PART_TIME" | "CONTRACT",
      locationType: locationType as "REMOTE" | "HYBRID" | "ONSITE",
      locationReq: locationReq || undefined,
      salaryMin: salaryMin ? parseInt(salaryMin, 10) : undefined,
      salaryMax: salaryMax ? parseInt(salaryMax, 10) : undefined,
      whyApply: whyApply || undefined,
    }

    try {
      if (isEditing) {
        await updatePosting.mutateAsync({ id: posting.id, ...data })
      } else {
        await createPosting.mutateAsync(data)
      }
      setSuccess(true)
      if (!isEditing) {
        router.push("/dashboard")
      }
    } catch {
      setError("Failed to save. Please try again.")
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="posting-title">Title</label>
        <input
          id="posting-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="posting-department">Department</label>
        <input
          id="posting-department"
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="posting-description">Description</label>
        <textarea
          id="posting-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
        />
      </div>

      <div>
        <label htmlFor="posting-responsibilities">Responsibilities</label>
        <textarea
          id="posting-responsibilities"
          value={responsibilities}
          onChange={(e) => setResponsibilities(e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="posting-experience-level">Experience Level</label>
        <select
          id="posting-experience-level"
          value={experienceLevel}
          onChange={(e) => setExperienceLevel(e.target.value)}
        >
          <option value="ENTRY">Entry</option>
          <option value="MID">Mid</option>
          <option value="SENIOR">Senior</option>
          <option value="EXECUTIVE">Executive</option>
        </select>
      </div>

      <div>
        <label htmlFor="posting-employment-type">Employment Type</label>
        <select
          id="posting-employment-type"
          value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}
        >
          <option value="FULL_TIME">Full Time</option>
          <option value="PART_TIME">Part Time</option>
          <option value="CONTRACT">Contract</option>
        </select>
      </div>

      <div>
        <label htmlFor="posting-location-type">Location Type</label>
        <select
          id="posting-location-type"
          value={locationType}
          onChange={(e) => setLocationType(e.target.value)}
        >
          <option value="REMOTE">Remote</option>
          <option value="HYBRID">Hybrid</option>
          <option value="ONSITE">Onsite</option>
        </select>
      </div>

      <div>
        <label htmlFor="posting-location-req">Location Requirement</label>
        <input
          id="posting-location-req"
          type="text"
          value={locationReq}
          onChange={(e) => setLocationReq(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="posting-salary-min">Minimum Salary</label>
        <input
          id="posting-salary-min"
          type="number"
          value={salaryMin}
          onChange={(e) => setSalaryMin(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="posting-salary-max">Maximum Salary</label>
        <input
          id="posting-salary-max"
          type="number"
          value={salaryMax}
          onChange={(e) => setSalaryMax(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="posting-skills">Required Skills</label>
        <input
          id="posting-skills"
          type="text"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleAddSkill}
          placeholder="Type a skill and press Enter"
        />
        <div className="mt-1 flex flex-wrap gap-1">
          {requiredSkills.map((skill) => (
            <span
              key={skill}
              className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-xs"
            >
              {skill}
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="text-blue-600"
              >
                x
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="posting-why-apply">Why Apply</label>
        <textarea
          id="posting-why-apply"
          value={whyApply}
          onChange={(e) => setWhyApply(e.target.value)}
          rows={3}
        />
      </div>

      {error && <p role="alert">{error}</p>}
      {success && <p>Saved successfully.</p>}

      <button type="submit" disabled={mutation.isPending}>
        Save
      </button>
    </form>
  )
}
