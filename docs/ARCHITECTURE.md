# Kiến trúc dữ liệu Motion Atlas

```mermaid
flowchart LR
    M[MicroLens media và metadata] --> C[Kiểm tra file và lập danh mục 10.000 video]
    M --> H[Chuỗi tương tác MicroLens]
    K[Log KuaiRand] --> B[Phân bố hành vi theo thời lượng]
    C --> G[Bộ tạo phiên đa thiết bị]
    B --> G
    G --> N[NDJSON theo giờ nhận]
    N --> R[Phát lại theo replay_at_ms]
    R --> D[Khử trùng theo event_id]
    D --> A[Tổng hợp theo event_time_ms]
    A --> S[Đặc trưng và đề xuất]
    H --> E[Đánh giá theo thứ tự tương tác gốc]
```

Tại thời điểm tiếp nhận, kiểm tra liên kết ID và lưu dấu vết bản phát hành. Với mỗi video nhập thành công, tải metadata kỹ thuật và tính đặc trưng từ chính tệp media. Khi tạo stream, lấy mẫu hành vi KuaiRand theo nhóm thời lượng, gán phiên và thiết bị, rồi tạo độ trễ gửi. Giữ thứ tự thời gian hành động khác với thứ tự nhận để đo cách xử lý dữ liệu đến muộn.

Đánh giá khả năng xử lý streaming trên luồng mô phỏng. Đánh giá khả năng đề xuất video tiếp theo trên các chuỗi MicroLens thật đã giữ riêng, chia theo thứ tự tương tác. Bảng tin web hiện nhận tệp người dùng tải lên và ghi tương tác trực tiếp vào SQLite. Luồng nghiên cứu và định dạng NDJSON được mô tả ở [thiết kế dữ liệu](../data/SOURCES.md).
