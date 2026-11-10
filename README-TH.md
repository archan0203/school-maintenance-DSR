# ระบบบริหารจัดการงานซ่อมแซมโรงเรียน

โปรเจกต์เริ่มต้นสำหรับใช้งานจริงแบบออนไลน์ด้วย Next.js + Supabase

## สิ่งที่มีในรุ่นเริ่มต้น
- เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน
- บทบาท `admin`, `technician`, `staff`
- ครู/บุคลากรสร้างรายการและเห็นรายการของตนเอง
- ช่างและ Admin เห็นรายการทั้งหมด
- Admin มอบหมายช่าง
- Admin/ช่างเปลี่ยนสถานะและบันทึกผลซ่อม
- ฟิลด์จำนวนวัสดุ ราคาต่อหน่วย ค่าแรง และยอดรวมอยู่ในบันทึกผลซ่อม
- รายงานเบื้องต้น

## 1. ติดตั้งโปรแกรมบนคอมพิวเตอร์
1. ติดตั้ง Node.js รุ่น LTS จาก https://nodejs.org/
2. ติดตั้ง Visual Studio Code จาก https://code.visualstudio.com/
3. แตกไฟล์ ZIP นี้
4. เปิดโฟลเดอร์ `school-maintenance` ด้วย VS Code
5. เปิด Terminal ใน VS Code แล้วรัน `npm install`

## 2. สร้างฐานข้อมูล Supabase
1. เข้า https://supabase.com/ แล้วสมัครบัญชี
2. กด New project
3. ตั้งชื่อเช่น `school-maintenance`
4. ตั้งรหัสผ่านฐานข้อมูลที่คาดเดายากและเก็บไว้
5. เลือก Region ที่ใกล้ประเทศไทยที่สุดเท่าที่มีให้เลือก
6. รอให้โปรเจกต์สร้างเสร็จ
7. ไปที่ SQL Editor > New query
8. เปิดไฟล์ `supabase/schema.sql` คัดลอกทั้งหมดไปวาง แล้วกด Run
9. ไปที่ Project Settings > API แล้วคัดลอก Project URL และ anon/publishable key

## 3. เชื่อมเว็บไซต์กับ Supabase
1. คัดลอกไฟล์ `.env.example` แล้วเปลี่ยนชื่อเป็น `.env.local`
2. ใส่ค่าจริง:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key
3. ห้ามใส่ `service_role` key ในตัวแปรที่ขึ้นต้นด้วย `NEXT_PUBLIC_` หรือในโค้ดฝั่งเบราว์เซอร์

## 4. สร้างผู้ดูแลระบบคนแรก
1. Supabase > Authentication > Users > Add user
2. สร้างผู้ใช้ด้วยอีเมลและรหัสผ่านของผู้ดูแล
3. เปิด SQL Editor แล้วรันคำสั่งนี้ โดยแทนอีเมลจริง:

```sql
update public.profiles
set role = 'admin', full_name = 'ผู้ดูแลระบบ'
where id = (
  select id from auth.users where email = 'admin@school.ac.th'
);
```

4. สร้างบัญชีครูและช่างใน Authentication > Users > Add user
5. บัญชีใหม่จะเป็น `staff` อัตโนมัติ หากต้องการตั้งเป็นช่าง ให้รัน:

```sql
update public.profiles
set role = 'technician', full_name = 'ชื่อช่าง'
where id = (
  select id from auth.users where email = 'technician@school.ac.th'
);
```

## 5. ทดสอบในเครื่อง
ใน Terminal:
```bash
npm run dev
```
เปิด http://localhost:3000 แล้วเข้าสู่ระบบ

## 6. เผยแพร่ขึ้นอินเทอร์เน็ตด้วย Vercel
1. สมัคร https://vercel.com/
2. สร้าง GitHub repository แบบ Private แล้วอัปโหลดไฟล์โปรเจกต์นี้
3. ใน Vercel เลือก Add New > Project แล้ว Import repository
4. เพิ่ม Environment Variables สองค่าเดียวกับ `.env.local`
5. กด Deploy
6. เมื่อ Deploy สำเร็จจะได้ URL เว็บไซต์
7. กลับไป Supabase > Authentication > URL Configuration
8. ตั้ง Site URL เป็น URL ของ Vercel และเพิ่ม Redirect URL ตาม URL เว็บไซต์

## ข้อควรทราบก่อนใช้กับข้อมูลจริง
- ไฟล์นี้เป็น starter project ที่ต้องติดตั้งและทดสอบก่อนเปิดใช้ทั้งโรงเรียน
- สร้างบัญชีผู้ใช้ผ่าน Supabase Dashboard ในรุ่นเริ่มต้น; ยังไม่มีหน้าเชิญผู้ใช้ในเว็บ
- รูปภาพถูกเก็บใน private bucket; ควรเพิ่ม signed URL สำหรับแสดงภาพในหน้ารายละเอียดก่อนใช้งานจริง
- ควรทดสอบ RLS ด้วยบัญชี Admin, ช่าง และครูแยกกันก่อน
- ตั้งนโยบายสำรองข้อมูล และกำหนดผู้ดูแลบัญชี Supabase ของโรงเรียน
- ห้ามเผยแพร่ Database password หรือ service_role key
- ถ้าจะใช้งานจริงทั้งโรงเรียน ควรให้ผู้ดูแลระบบตรวจสอบสิทธิ์/นโยบายข้อมูลและทดสอบระบบก่อนเปิดใช้
