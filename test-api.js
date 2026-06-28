async function runTests() {
  const baseUrl = 'http://localhost:5000/api';
  console.log('--- STARTING AUTOMATED BACKEND VERIFICATION ---');

  // 1. Login
  console.log('\n1. Logging in as hospital@swiflare.com...');
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hospital@swiflare.com', password: 'Password123!' }),
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }
  
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  console.log('Login successful! Token acquired.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Get Courses
  console.log('\n2. Fetching courses...');
  const coursesRes = await fetch(`${baseUrl}/academic/courses`, { headers: authHeaders });
  const coursesData = await coursesRes.json();
  console.log('Courses retrieved:', coursesData.data.map((c) => c.name));

  // 3. Get Batches
  console.log('\n3. Fetching batches...');
  const batchesRes = await fetch(`${baseUrl}/academic/batches`, { headers: authHeaders });
  const batchesData = await batchesRes.json();
  console.log('Batches retrieved:', batchesData.data.map((b) => b.year));

  // 4. Get Students
  console.log('\n4. Fetching students with computed eligibility...');
  const studentsRes = await fetch(`${baseUrl}/academic/students`, { headers: authHeaders });
  const studentsData = await studentsRes.json();
  const students = studentsData.data;
  console.log(`Retrieved ${students.length} students:`);
  
  students.forEach((s) => {
    console.log(`- ${s.firstName} ${s.lastName} (${s.enrollmentId}): Fee Remitted: ${s.remittedToAcademy}, Attendance: ${s.attendancePercentage}%, Thesis Approved: ${s.thesisApproved} -> Eligible: ${s.isEligible}`);
  });

  // Verify initial statuses
  const aarav = students.find((s) => s.firstName === 'Aarav');
  const neha = students.find((s) => s.firstName === 'Neha');
  const rahul = students.find((s) => s.firstName === 'Rahul');
  const priya = students.find((s) => s.firstName === 'Priya');

  if (!aarav || !aarav.isEligible) {
    console.error('Error: Aarav should be Eligible!');
  } else {
    console.log('Success: Aarav is correctly Eligible.');
  }

  if (neha?.isEligible || rahul?.isEligible || priya?.isEligible) {
    console.error('Error: Neha, Rahul, and Priya should not be Eligible!');
  } else {
    console.log('Success: Non-eligible students correctly filtered.');
  }

  // 5. Evaluate Eligibility detail checklist for Aarav
  console.log(`\n5. Evaluating detailed checklist for Aarav (${aarav._id})...`);
  const eligRes = await fetch(`${baseUrl}/academic/students/${aarav._id}/eligibility`, { headers: authHeaders });
  const eligData = await eligRes.json();
  console.log('Checklist decision:', eligData.data.decision);
  console.log('Checklist details:', JSON.stringify(eligData.data.checklist, null, 2));

  // 6. Update Academic Metrics (Make Neha Eligible by updating attendance from 68% to 80%)
  console.log(`\n6. Updating academic metrics for Neha (${neha._id}) to satisfy 75% attendance...`);
  const updateRes = await fetch(`${baseUrl}/academic/students/${neha._id}/academic-metrics`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ attendancePercentage: 80, thesisApproved: true }),
  });
  const updateData = await updateRes.json();
  console.log('Update response code:', updateRes.status);
  console.log('Updated Neha details:', {
    firstName: updateData.data.firstName,
    attendancePercentage: updateData.data.attendancePercentage,
    thesisApproved: updateData.data.thesisApproved,
    isEligible: updateData.data.isEligible
  });

  if (updateData.data.isEligible) {
    console.log('Success: Neha is now Eligible after attendance update!');
  } else {
    console.error('Error: Neha should be Eligible after update.');
  }

  // 7. Make student Not Eligible
  console.log(`\n7. Making Aarav (${aarav._id}) Not Eligible by dropping attendance to 65%...`);
  const updateAaravRes = await fetch(`${baseUrl}/academic/students/${aarav._id}/academic-metrics`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ attendancePercentage: 65, thesisApproved: true }),
  });
  const updateAaravData = await updateAaravRes.json();
  console.log('Updated Aarav eligibility:', updateAaravData.data.isEligible);
  if (!updateAaravData.data.isEligible) {
    console.log('Success: Aarav is now correctly Not Eligible.');
  } else {
    console.error('Error: Aarav should be Not Eligible after attendance drop.');
  }

  console.log('\n--- AUTOMATED BACKEND VERIFICATION COMPLETED ---');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
