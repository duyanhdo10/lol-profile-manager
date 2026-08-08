<p align="center">
  <img src="src/assets/logo.png" alt="Logo LoL Profile Manager" width="180" />
</p>

<h1 align="center">LoL Profile Manager</h1>

<p align="center">
  <a href="https://github.com/duyanhdo10/lol-profile-manager/actions/workflows/ci.yml"><img src="https://github.com/duyanhdo10/lol-profile-manager/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/duyanhdo10/lol-profile-manager/releases"><img src="https://img.shields.io/github/v/release/duyanhdo10/lol-profile-manager?include_prereleases" alt="Phiên bản" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/duyanhdo10/lol-profile-manager" alt="Giấy phép MIT" /></a>
</p>

<p align="center">
  Ứng dụng desktop mã nguồn mở giúp xem trước và quản lý diện mạo hồ sơ League of Legends trên Windows.
</p>

> [!WARNING]
> Dự án đang ở giai đoạn **Beta**. Ứng dụng sử dụng LCU — API cục bộ không được Riot Games hỗ trợ
> chính thức và có thể thay đổi sau mỗi bản cập nhật League Client.

## Giới thiệu

LoL Profile Manager kết nối trực tiếp với League Client đang chạy trên máy để đọc hồ sơ, tạo bản xem
trước và áp dụng các thay đổi về diện mạo xã hội. Trước khi ghi dữ liệu, ứng dụng luôn hiển thị toàn bộ
giao dịch để người dùng kiểm tra.

Ứng dụng không mua, mở khóa hoặc cấp quyền sở hữu bất kỳ nội dung nào. Vật phẩm chưa sở hữu vẫn có thể
được chọn để thử, nhưng League Client có quyền từ chối khi áp dụng.

## Tính năng

- Duyệt và xem trước biểu tượng hồ sơ cùng ảnh nền trang phục tướng.
- Tạo Showcase từ danh hiệu thử thách, tối đa ba token có thứ tự, banner và regalia.
- Chỉnh tin nhắn trạng thái và diện mạo hạng hiển thị trên hovercard.
- Xem trước hồ sơ hiện tại và bản nháp trước khi áp dụng.
- Giao dịch sáu bước có rollback: dừng tại lỗi đầu tiên và hoàn tác các bước đã hoàn thành theo thứ tự
  ngược.
- Theo dõi ownership và ghi nhớ vật phẩm từng bị đúng phiên bản League Client từ chối.
- Catalog CommunityDragon cache-first, vẫn duyệt được khi ngoại tuyến và tự cảnh báo khi cache cũ hoặc
  sai patch.
- Metadata catalog bằng tiếng Việt với fallback riêng từng tệp sang tiếng Anh.
- Chuyển ngôn ngữ `Tự động / Tiếng Việt / English`; chế độ Tự động đọc locale của League Client.
- Không tự động áp dụng lại thay đổi sau khi League Client kết nối lại.

## Yêu cầu

- Windows 64-bit.
- League of Legends và League Client đã cài đặt. Không cần mở client nếu chỉ duyệt cache có sẵn.
- Để phát triển: Node.js `24.18.x` và npm `11` trở lên.

## Chạy dự án

```powershell
npm ci
npm run dev
```

Vite phục vụ renderer tại `127.0.0.1`, sau đó Electron biên dịch main process và mở ứng dụng desktop.

### Build và đóng gói

```powershell
# Build Electron và renderer production
npm run build

# Tạo bộ cài NSIS Windows x64 trong thư mục release/
npm run package
```

## Các lệnh hữu ích

| Lệnh                    | Mục đích                                                     |
| ----------------------- | ------------------------------------------------------------ |
| `npm run dev`           | Chạy ứng dụng ở chế độ phát triển                            |
| `npm run format`        | Format TypeScript, JSX, CSS và các tệp cấu hình              |
| `npm run lint`          | Kiểm tra TypeScript/React bằng ESLint                        |
| `npm run lint:css`      | Kiểm tra CSS Modules bằng Stylelint                          |
| `npm run typecheck`     | Kiểm tra TypeScript cho renderer và Electron                 |
| `npm test`              | Chạy unit, integration và renderer tests                     |
| `npm run test:e2e`      | Build và chạy Electron E2E bằng Playwright                   |
| `npm run verify`        | Chạy format check, lint, typecheck, test và production build |
| `npm run audit:runtime` | Kiểm tra lỗ hổng critical trong dependency runtime           |
| `npm run package`       | Tạo bộ cài Windows x64                                       |

## Kiến trúc

```text
electron/
  main.ts                 Composition root và cấu hình cửa sổ bảo mật
  ipc-registration.ts     Đăng ký IPC và chuẩn hóa lỗi
  lcu-client.ts           Kết nối, theo dõi và giao tiếp với League Client
  catalog-service.ts      Tải, chuẩn hóa, cache và localized fallback catalog
  apply-service.ts        Preview, apply và rollback giao dịch hồ sơ

src/shared/models/        Contract dùng chung giữa main, preload và renderer
src/renderer/
  app/                    Router, layout và Mantine theme
  features/settings/      Preference ngôn ngữ và i18n
  pages/                  Các màn hình chỉnh sửa hồ sơ
  store/                  Lifecycle, catalog, draft và apply state

tests/
  unit/                   Validation, locale, catalog/cache và migration
  integration/            Giao dịch apply/rollback
  renderer/               React UI và lifecycle
  e2e/                    Ứng dụng Electron hoàn chỉnh
```

Renderer được viết bằng React, Mantine, Zustand và TypeScript. Mọi quyền truy cập LCU, filesystem và
CommunityDragon đều nằm trong Electron main process và chỉ được cung cấp qua preload bridge có kiểu dữ
liệu rõ ràng.

## Bảo mật và dữ liệu

- Tắt Node integration; bật context isolation và Chromium sandbox trong renderer.
- Kiểm tra nguồn gửi IPC và chỉ công khai các thao tác hồ sơ đã định nghĩa trước.
- Credential LCU chỉ được đọc cục bộ từ lockfile, giữ trong main process và không chuyển sang renderer.
- Ảnh từ xa chỉ được proxy từ allowlist `raw.communitydragon.org`.
- Content Security Policy chặn script, frame, form và kết nối mạng không được phép.
- Catalog cache, compatibility records và log chẩn đoán được lưu trong thư mục `userData` của Electron.
- Log được giới hạn dung lượng; ứng dụng không có telemetry và không gửi dữ liệu hồ sơ tới máy chủ của
  dự án.

## Nguồn dữ liệu

Tên, mô tả và asset catalog được lấy từ
[CommunityDragon](https://communitydragon.org/). Ảnh luôn dùng asset `global/default`; metadata tiếng
Việt dùng `global/vi_vn` và tự fallback sang English nếu một tệp localized không khả dụng.

## Giới hạn hiện tại

- Chỉ hỗ trợ Windows x64.
- Chỉ dịch đầy đủ tiếng Việt và tiếng Anh.
- Chưa có preset, lịch sử giao dịch, purchase history, diagnostics UI hoặc API request tùy ý.
- Status, rank hovercard và một số diện mạo xã hội có thể bị League Client đặt lại.
- Cache thuộc patch khác chỉ dùng để duyệt; Apply sẽ bị khóa cho đến khi có snapshot phù hợp.

## Đóng góp

1. Fork repository và tạo branch cho thay đổi của bạn.
2. Cài dependency bằng `npm ci`.
3. Chạy `npm run verify` và `npm run test:e2e` trước khi tạo pull request.
4. Mô tả rõ hành vi LCU bị ảnh hưởng và cách đã kiểm thử.

## Tuyên bố miễn trừ trách nhiệm

LoL Profile Manager là dự án cộng đồng, không được Riot Games phát triển, tài trợ hoặc chứng thực.
League of Legends và Riot Games là nhãn hiệu của Riot Games, Inc. Việc sử dụng ứng dụng hoàn toàn do
người dùng tự chịu trách nhiệm.

## Giấy phép

Dự án được phát hành theo giấy phép [MIT](LICENSE).
