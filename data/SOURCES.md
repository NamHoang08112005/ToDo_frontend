# Bộ dữ liệu cho mô phỏng streaming

Mục tiêu là **10.000 video MicroLens phát được** và một luồng sự kiện phát lại đa thiết bị. KuaiRand dùng để ước lượng hành vi. Gói đầy đủ còn phụ thuộc vào quyền truy cập và kết quả kiểm tra tệp nguồn. Bốn tệp trong `examples/` là dữ liệu tự tạo để minh họa cấu trúc, đánh dấu bằng `is_fixture: true`.

| Tệp đầu ra | Một dòng đại diện cho | Khóa |
| --- | --- | --- |
| `catalog.ndjson` | Một video đã đối chiếu tệp media với metadata MicroLens | `video_id` duy nhất |
| `microlens-history.ndjson` | Một vị trí trong chuỗi tương tác của một người dùng MicroLens | `source_user_id` + `seq_index` |
| `kuairand-observations.ndjson` | Một quan sát KuaiRand dùng để ước lượng hành vi | `observation_id` gồm phiên bản, tên tệp và số dòng nguồn |
| `stream-input.ndjson` | Một lần pipeline nhận sự kiện trên một thiết bị | `event_id` định danh hành động. Một hành động có thể xuất hiện lại khi gửi bù |

## MicroLens

Giữ ID video gốc dưới dạng chuỗi và đặt tiền tố `microlens:` cho `video_id` trong bộ đầu ra. Ghép metadata, ảnh bìa và media bằng ID trong cùng bản phát hành. Đọc thời lượng, codec, độ phân giải từ tệp. Tính SHA-256 để nhận diện bản sao byte. Với 10.000 mục cuối, mỗi mục phải khớp metadata, giải mã được toàn bộ, có ID và checksum duy nhất. `media_key` và `cover_key` tham chiếu tệp hoặc object storage. Giữ `null` cho metadata chưa có, ví dụ ID tác giả.

Giữ chuỗi tương tác gốc theo `seq_index`, đánh số từ 0. `event_time_ms` trong lịch sử gốc chỉ điền khi bản phát hành có timestamp thực theo bản ghi. Nếu lưu tổng lượt xem và lượt thích, coi đó là metadata cấp video. [Tài liệu MicroLens](https://github.com/westlake-repl/MicroLens)

## KuaiRand

Giữ `time_ms`, ID gốc, thời lượng phát thực tế, cờ click/like và chính sách đã chọn log. Chuẩn hóa `play_time_ms` và `duration_ms` theo đơn vị mili giây, giữ giá trị xem lớn hơn thời lượng khi bản ghi nguồn phản ánh việc xem lại. Dùng cùng một bản ghi để lấy mẫu thời lượng xem và các cờ phản hồi, ưu tiên nhóm có thời lượng video tương tự. ID của hai nguồn thuộc hai không gian định danh độc lập. Tham chiếu `observation_id` để truy xuất mẫu hành vi dùng cho mô phỏng. [Tài liệu KuaiRand](https://github.com/chongminggao/KuaiRand)

## Đầu vào phát lại

- `event_time_ms` là thời gian hành động trên thiết bị, tính từ lúc bắt đầu kịch bản. `replay_at_ms` dùng cùng mốc 0 và biểu diễn lúc máy chủ nhận. Tệp sắp tăng dần theo `replay_at_ms`.
- `user_id` là định danh mô phỏng. Mỗi `session_id` có một `device_type` như `phone`, `desktop` hoặc `tablet`. Cùng một người có thể có nhiều phiên.
- `watch_ms` trên `play_end` có thể vượt thời lượng nếu kịch bản có vòng lặp. Thời điểm của từng `play_start`, `play_end` và `like` là thời điểm tạo bởi kịch bản từ log cấp lượt tương tác.
- `behavior_source` và `observation_id` ghi xuất xứ mẫu hành vi. `is_simulated: true` đánh dấu việc gán hành vi và thiết bị cho video. `is_fixture: true` đánh dấu ví dụ viết tay.
- Khi thiết bị gửi lại, giữ nguyên `event_id` và payload hành động. Dòng gửi lại đổi `replay_at_ms`. Ở tốc độ 1×, bộ mô phỏng đợi theo chênh lệch `replay_at_ms` giữa hai dòng rồi phát dòng tiếp theo.

Mẫu có một lượt thích được gửi hai lần. Sau khi khử trùng theo `event_id`, số lượt thích là **1**. Lần phát bắt đầu trên điện thoại trước máy tính theo `event_time_ms`, và đi vào pipeline sau máy tính theo `replay_at_ms).
