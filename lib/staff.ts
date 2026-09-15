import type { Division } from './division-list'

export interface StaffMember {
  sn: number
  name: string
  phone: string | null
  division: Division
}

/**
 * Official IPPIS division roster (2026) — 88 staff across the 7 divisions,
 * with verified phone numbers. A staff member verifies and votes with the
 * phone number on this roll.
 */
export const staffList: StaffMember[] = [
  // ── Director IPPIS Office (8) ──
  { sn: 1, name: 'EKWEM Virginus E. N.', phone: '08037051065', division: 'Director IPPIS Office' },
  { sn: 2, name: 'Anosike Catherine E.', phone: '08145334685', division: 'Director IPPIS Office' },
  { sn: 3, name: 'EZEUDE Ifeanyichukwu James', phone: '07039809179', division: 'Director IPPIS Office' },
  { sn: 4, name: 'ACHAYI, Timothy', phone: '08133366991', division: 'Director IPPIS Office' },
  // NOTE: 10 digits on the source sheet — confirm the missing digit with the admin.
  { sn: 5, name: 'SHINGA Akila Talatu', phone: '0806934053', division: 'Director IPPIS Office' },
  { sn: 6, name: 'MATHIAS Ishaku', phone: '08028289864', division: 'Director IPPIS Office' },
  { sn: 7, name: 'OGBU Jude Ochima', phone: '08162353685', division: 'Director IPPIS Office' },
  { sn: 8, name: 'HANGE Joseph Sekav', phone: '09020069915', division: 'Director IPPIS Office' },

  // ── Payroll (14) ──
  { sn: 9, name: 'KALLAMU Dauda Musa', phone: '08067973768', division: 'Payroll' },
  { sn: 10, name: 'GOKUUM Onmat Mabel', phone: '08035970025', division: 'Payroll' },
  { sn: 11, name: 'Zubairu Idris', phone: '08050564242', division: 'Payroll' },
  { sn: 12, name: 'AROWOSAYE Isaac Oluwaseun', phone: '08039590335', division: 'Payroll' },
  { sn: 13, name: 'BALOGUN Olatayo Michael', phone: '09124396232', division: 'Payroll' },
  { sn: 14, name: 'MEYANGA Zainab Blessing', phone: '08035904265', division: 'Payroll' },
  { sn: 15, name: 'YUSUF Bashir Ilela', phone: '08065610736', division: 'Payroll' },
  // NOTE: 10 digits on the source sheet — confirm the missing digit with the admin.
  { sn: 16, name: 'GARBA David Antuwa', phone: '0803637484', division: 'Payroll' },
  { sn: 17, name: 'OKONKWO Helen Moses', phone: '07033727267', division: 'Payroll' },
  { sn: 18, name: 'ADEFARATI Mary Adebola', phone: '08065543215', division: 'Payroll' },
  { sn: 19, name: 'OLA-OJO Grace Bosede', phone: '09032156789', division: 'Payroll' },
  { sn: 20, name: 'SULEIMAN Musa Bazza', phone: '07063218132', division: 'Payroll' },
  { sn: 21, name: 'TOMOTHY Beatrice', phone: '08091225508', division: 'Payroll' },
  { sn: 22, name: 'UHIARA Ikechi Precious', phone: '07035145099', division: 'Payroll' },

  // ── Payment (17) ──
  { sn: 23, name: 'KISO Umar', phone: '07061665761', division: 'Payment' },
  { sn: 24, name: 'Wada Muhammad Danladi', phone: '07034123159', division: 'Payment' },
  { sn: 25, name: 'HWANDE Joseph Terna', phone: '08134887487', division: 'Payment' },
  { sn: 26, name: 'MALGWI Grace Samuel', phone: '08054718930', division: 'Payment' },
  { sn: 27, name: 'IHEANACHO Stella Onyinyechi', phone: '08086611168', division: 'Payment' },
  { sn: 28, name: 'UKWUEGBU Ihuoma Augustina', phone: '08035442227', division: 'Payment' },
  { sn: 29, name: 'ALO Franklin Oladipo', phone: '07032144366', division: 'Payment' },
  { sn: 30, name: 'EZUGWU Chika Dilys', phone: '08057910458', division: 'Payment' },
  { sn: 31, name: 'DAUDA Kudan Florence', phone: '08132214090', division: 'Payment' },
  { sn: 32, name: 'ONANUGA Taibat Bolanle', phone: '07084251790', division: 'Payment' },
  { sn: 33, name: 'NGOZI Kaboloobari Augustus', phone: '08039433902', division: 'Payment' },
  { sn: 34, name: 'BITRUS Adams Lawrence', phone: '08169666937', division: 'Payment' },
  { sn: 35, name: 'EBERE Petronilla Nwakaego', phone: '08060104175', division: 'Payment' },
  { sn: 36, name: 'SULE Joy Aishatu', phone: '08033115251', division: 'Payment' },
  { sn: 37, name: 'ABU Godwin Adolphus', phone: '07038873870', division: 'Payment' },
  { sn: 38, name: 'NMEREGINI Hope Nkiruka', phone: '07031135686', division: 'Payment' },
  { sn: 39, name: 'ONWEH Christian Bamiyo', phone: '08064323840', division: 'Payment' },

  // ── Admin (12) ──
  { sn: 40, name: 'MOHAMMED Mallam Baba', phone: '08101873888', division: 'Admin' },
  { sn: 41, name: 'ANI Jacinta', phone: '08037880497', division: 'Admin' },
  { sn: 42, name: 'DOSUNMU Olajide Rasaki', phone: '07072032196', division: 'Admin' },
  { sn: 43, name: 'LONGMUT Marcus', phone: '08133306970', division: 'Admin' },
  { sn: 44, name: 'ORUNGBEMI Oloruntobi Babadehinde', phone: '08034191787', division: 'Admin' },
  { sn: 45, name: 'IBRAHIM Aminu Makpa', phone: '07033896063', division: 'Admin' },
  { sn: 46, name: 'UMAR Salisu Alhaji', phone: '08035927308', division: 'Admin' },
  { sn: 47, name: 'DIMGBA David Ikechukwu', phone: '08030926595', division: 'Admin' },
  { sn: 48, name: 'ANDREW ESTHER Masoyi', phone: '07035308782', division: 'Admin' },
  { sn: 49, name: 'ADELEKE Sunday Oluwagbeminiyi', phone: '09157715815', division: 'Admin' },
  { sn: 50, name: 'ADEOYE Blessing Oluwaseyi', phone: '07036523380', division: 'Admin' },
  { sn: 51, name: 'MUNTARI Usman Abdullahi', phone: '09046665366', division: 'Admin' },

  // ── Audit/Checking (7) ──
  { sn: 52, name: 'ADEBOLU Ebunoluwa Adeyemi', phone: '08054448367', division: 'Audit/Checking' },
  { sn: 53, name: 'Sadiku Alaba Richard', phone: '08023664670', division: 'Audit/Checking' },
  { sn: 54, name: 'CECILIA Afe John', phone: '09036135623', division: 'Audit/Checking' },
  { sn: 55, name: 'OGUNLEYE Olufunmilayo Temidayo', phone: '07066275496', division: 'Audit/Checking' },
  { sn: 56, name: 'OKWO Majestic Eloho', phone: '08165158549', division: 'Audit/Checking' },
  { sn: 57, name: 'MOHAMMED Ibrahim', phone: '08052761679', division: 'Audit/Checking' },
  { sn: 58, name: 'AJAO Taofeek', phone: '08172875191', division: 'Audit/Checking' },

  // ── ICT (16) ──
  { sn: 59, name: 'MOHAMMED Saidu Koro', phone: '08033300868', division: 'ICT' },
  { sn: 60, name: 'ALKALI Baba Kaumi', phone: '08065581986', division: 'ICT' },
  { sn: 61, name: 'BELLO Abdulrazaq', phone: '08037879735', division: 'ICT' },
  { sn: 62, name: 'YUSUF Ibraheem Olatunji', phone: '08054625401', division: 'ICT' },
  { sn: 63, name: 'ODEY Emmanuel Ojomg', phone: '08114228384', division: 'ICT' },
  { sn: 64, name: 'NWUJU Obinna', phone: '07038321695', division: 'ICT' },
  { sn: 65, name: 'ALIYU Abdul', phone: '08033525415', division: 'ICT' },
  { sn: 66, name: 'MUHAMMED Umar Faruk', phone: '07034859730', division: 'ICT' },
  { sn: 67, name: 'UGWU-ANDREW Chinwe Augustina', phone: '08035996500', division: 'ICT' },
  { sn: 68, name: 'YUSUF Olumide Sikiru', phone: '08035967019', division: 'ICT' },
  { sn: 69, name: 'AMADI Cinonye Faith', phone: '09031557335', division: 'ICT' },
  { sn: 70, name: 'ENOGELA Chinyere Jennifer', phone: '08038384134', division: 'ICT' },
  { sn: 71, name: 'IYERE Bridget Ogba', phone: '08127778919', division: 'ICT' },
  { sn: 72, name: 'YOUNG-AMEH Roselyn Chidinma', phone: '08055454891', division: 'ICT' },
  { sn: 73, name: 'ABUBAKAR Saidu Koto', phone: '08065485082', division: 'ICT' },
  { sn: 74, name: 'ISOLA-Gbemisola Precious', phone: '08106743960', division: 'ICT' },

  // ── Third Party (14) ──
  { sn: 75, name: 'UKAOHA Barry Monday', phone: '08036932378', division: 'Third Party' },
  { sn: 76, name: 'EZEOBIORAH Uche Miriam', phone: '08033322880', division: 'Third Party' },
  { sn: 77, name: 'ARIAGBOBE Efezino', phone: '08032101025', division: 'Third Party' },
  { sn: 78, name: 'AKPAN Maria Anthony', phone: '08038757052', division: 'Third Party' },
  { sn: 79, name: 'OKONKWO Pius Ogoh', phone: '08033451976', division: 'Third Party' },
  { sn: 80, name: 'EVONG Aaning E. I.', phone: '07055812014', division: 'Third Party' },
  { sn: 81, name: 'HARUNA Jibril Hassana', phone: '08035093755', division: 'Third Party' },
  { sn: 82, name: 'GADZAMA Philemon Midanda', phone: '08059058616', division: 'Third Party' },
  { sn: 83, name: 'ALAGBA Nevkaa Frank', phone: '08068005818', division: 'Third Party' },
  { sn: 84, name: 'Ogboji Anna Onyeche', phone: '07032139877', division: 'Third Party' },
  { sn: 85, name: 'SAMUEL Grace Asinamai', phone: '07035563647', division: 'Third Party' },
  { sn: 86, name: 'HASSAN Abdulrahman Auna', phone: '07034938441', division: 'Third Party' },
  // NOTE: source sheet had 12 digits (080359886157) — one digit is extraneous;
  // stored as the most plausible 11-digit reading. Confirm with the admin.
  { sn: 87, name: 'ADESINA Adeleke Abbey', phone: '08035986157', division: 'Third Party' },
  { sn: 88, name: 'SALAMI Zainab Adepeju', phone: '07068276355', division: 'Third Party' },
]

/**
 * Normalise a Nigerian phone number to a canonical form for comparison:
 * strips spaces, dashes, parentheses and a leading +234 / 234 country code,
 * and converts leading 0 to a consistent representation.
 * Returns digits only, e.g. "08037051065" or "2348037051065" -> "08037051065".
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^0-9]/g, '')
  if (digits.startsWith('234') && digits.length >= 13) {
    digits = '0' + digits.slice(3)
  } else if (digits.startsWith('+234')) {
    digits = '0' + digits.slice(4)
  }
  // Must be a valid Nigerian mobile-ish number: 11 digits starting with 0
  if (digits.length === 11 && digits.startsWith('0')) return digits
  return null
}

export function findStaffByPhone(raw: string): StaffMember | undefined {
  const normalized = normalizePhone(raw)
  if (!normalized) return undefined
  return staffList.find((member) => member.phone === normalized)
}
