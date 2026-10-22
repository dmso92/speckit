# Feature Specification: Purchase Order Management

**Feature Branch**: Not created (the current workspace is not a Git repository)

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: “Buyers at branches can create purchase orders to suppliers for products. Each PO contains multiple line items with quantities and expected prices. Track PO status (Draft, Submitted, Approved, Fulfilled, Cancelled). Suppliers receive notifications when POs are submitted. Include approval workflow for POs over $10,000.”

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Purchase Order (Priority: P1)

A buyer working at a branch creates a purchase order for one supplier, adds multiple products with quantities and expected unit prices, and saves the order as a draft. The buyer can review the draft before submitting it.

**Why this priority**: Creating a correct order is the foundation of the purchasing workflow and delivers value before notifications or approvals are involved.

**Independent Test**: A branch buyer can create and review a draft containing multiple valid line items, and the displayed order total matches the sum of each quantity multiplied by its expected unit price.

**Acceptance Scenarios**:

1. **Given** an authorized buyer at a branch and available suppliers and products, **When** the buyer creates a purchase order with multiple valid line items and saves it, **Then** the order is associated with that branch and supplier, contains the entered quantities and expected prices, and has status Draft.
2. **Given** a draft purchase order, **When** the buyer reviews it, **Then** the buyer can see the supplier, branch, every product, quantity, expected unit price, and calculated line and order totals.
3. **Given** a draft purchase order, **When** its buyer changes its supplier or line items, **Then** the draft reflects the changes and recalculates affected line and order totals.
4. **Given** a draft purchase order with a missing product, a non-positive quantity, or a negative expected price, **When** the buyer attempts to save or submit it, **Then** the invalid order is not accepted and the buyer is told what must be corrected.

### User Story 2 - Submit and Track an Order (Priority: P2)

A buyer submits a complete draft. The order becomes Submitted and the supplier receives an email and a supplier-portal notification with the order information. The buyer can track the order through its subsequent status changes.

**Why this priority**: Submission communicates the buyer's request to the supplier and starts the fulfillment process.

**Independent Test**: Submit a valid draft and verify that it is marked Submitted, that its supplier receives a notification, and that the buyer can later see its updated status.

**Acceptance Scenarios**:

1. **Given** a valid draft order, **When** the buyer submits it, **Then** its status changes to Submitted and its supplier receives an email and a supplier-portal notification identifying the order and summarizing its line items.
2. **Given** an order that has been submitted, **When** an authorized user views it, **Then** the user can see its current status and its branch, supplier, and line-item details.
3. **Given** an order in Draft, Submitted, Approved, Fulfilled, or Cancelled status, **When** the buyer views it, **Then** the displayed status matches its current lifecycle state.

### User Story 3 - Approve and Complete Orders (Priority: P3)

A designated approver reviews submitted orders whose total exceeds $10,000. An order requiring approval cannot proceed to fulfillment until approved. Authorized users can record fulfillment or cancel an eligible order.

**Why this priority**: Approval provides oversight for high-value commitments, while fulfillment and cancellation complete the order lifecycle.

**Independent Test**: Submit orders on both sides of the approval threshold and verify the required approval behavior, then verify the allowed fulfillment and cancellation outcomes.

**Acceptance Scenarios**:

1. **Given** a submitted order with a total greater than $10,000, **When** a designated organization-wide approver other than the submitting buyer approves it, **Then** its status changes to Approved and the approval decision is recorded.
2. **Given** a submitted order with a total greater than $10,000 that has not been approved, **When** a user attempts to mark it Fulfilled, **Then** the order remains unfulfilled and the user is told approval is required.
3. **Given** a submitted order whose total is $10,000 or less, **When** it is submitted, **Then** it does not require the high-value approval workflow.
4. **Given** a submitted order with a total greater than $10,000, **When** a designated organization-wide approver other than the submitting buyer rejects it, **Then** the rejection is recorded, the order remains Submitted, and it cannot be fulfilled.
5. **Given** an order that is eligible for fulfillment, **When** an authorized user records that it has been fulfilled, **Then** its status changes to Fulfilled.
6. **Given** an order in Draft, Submitted, or Approved status, **When** an authorized buyer cancels it, **Then** its status changes to Cancelled; a Fulfilled or already Cancelled order cannot be cancelled again.
7. **Given** a high-value order submitted by a designated approver, **When** that buyer attempts to approve or reject their own order, **Then** the decision is denied and the order remains Submitted without an approval decision.

### Edge Cases

- An order with no line items, a zero or negative quantity, or a negative expected price cannot be submitted.
- An order totaling exactly $10,000 does not trigger the “over $10,000” approval requirement; an order totaling more does.
- If a submitted order has a total over $10,000, it remains Submitted while awaiting an approval decision and cannot be fulfilled before approval.
- A rejected high-value order remains Submitted, with its rejection decision recorded, and cannot be fulfilled; the buyer may cancel it and create a replacement order.
- Supplier notifications are sent by both email and supplier-portal notification when submission succeeds, including for an order awaiting high-value approval.
- A fulfilled order cannot be edited, cancelled, or returned to an earlier status through this workflow.
- A buyer cannot submit a draft without an associated branch and supplier.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an authorized buyer associated with a branch to create a purchase order for one supplier.
- **FR-002**: The system MUST allow a purchase order to contain multiple product line items, each with a quantity and expected unit price.
- **FR-003**: The system MUST calculate each line-item amount from its quantity and expected unit price and calculate the order total from its line items.
- **FR-004**: The system MUST save a newly created purchase order in Draft status and allow the buyer to review its details before submission.
- **FR-005**: The system MUST allow the buyer to update the supplier and line items of a Draft order and recalculate affected line and order totals.
- **FR-006**: The system MUST prevent submission of an order that lacks a supplier, branch, or line item, or contains a non-positive quantity or negative expected unit price, and MUST explain the correction needed.
- **FR-007**: The system MUST support the purchase-order statuses Draft, Submitted, Approved, Fulfilled, and Cancelled.
- **FR-008**: The system MUST allow an authorized buyer to submit a valid draft order and change its status to Submitted.
- **FR-009**: Upon successful submission, the system MUST notify the order's supplier by both email and supplier-portal notification, including an order identifier and a summary of its line items.
- **FR-010**: The system MUST require an approval decision from a designated organization-wide approver other than the submitting buyer before an order with a total greater than $10,000 can be fulfilled.
- **FR-011**: The system MUST record approval or rejection by a designated organization-wide approver other than the submitting buyer for a high-value order; approval MUST change its status to Approved, while rejection MUST leave it Submitted and prevent fulfillment.
- **FR-012**: The system MUST allow an authorized user to mark an eligible order Fulfilled and MUST prevent fulfillment of an unapproved or rejected order requiring approval.
- **FR-013**: The system MUST allow an authorized buyer to cancel an order in Draft, Submitted, or Approved status and MUST prevent cancellation of an order that is Fulfilled or already Cancelled.
- **FR-014**: The system MUST display the current status and relevant order details to authorized users.
- **FR-015**: The system MUST preserve the association between each purchase order and its originating branch, supplier, and line items throughout its lifecycle.

### Key Entities *(include if feature involves data)*

- **Purchase Order**: A buyer's request for products from one supplier, associated with an originating branch and lifecycle status; includes the calculated total and relevant approval details.
- **Purchase Order Line Item**: A product included in an order, with an entered quantity, expected unit price, and calculated line amount.
- **Branch**: The buyer's organizational location associated with a purchase order.
- **Supplier**: The external party receiving the purchase order and its submission notification.
- **Approval Decision**: The decision made by a designated approver for a high-value submitted order.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 100% of valid test purchase orders save as Draft with their entered branch, supplier, products, quantities, and expected prices intact.
- **SC-002**: In acceptance testing, 100% of submitted orders produce both an email and a supplier-portal notification containing the correct order identifier and line-item summary.
- **SC-003**: In acceptance testing, 100% of orders totaling more than $10,000 are blocked from fulfillment until an approver records approval, while orders totaling $10,000 or less are not blocked by this approval rule.
- **SC-004**: At least 95% of representative branch buyers can create and submit a valid multi-line order without assistance in five minutes or less.
- **SC-005**: In acceptance testing, 100% of attempted lifecycle changes that violate the stated approval, fulfillment, or cancellation rules leave the order in its prior valid status.

## Assumptions

- The threshold is denominated in US dollars. “Over $10,000” means strictly greater than $10,000; exactly $10,000 does not require approval.
- The approval threshold uses the sum of quantity multiplied by expected unit price for all line items. Taxes, shipping, discounts, and currency conversion are outside this feature's stated total unless specified by the purchasing policy.
- Designated purchasing approvers are available organization-wide to approve or reject high-value orders; the submitting buyer cannot approve or reject their own order. One recorded approval is sufficient; a rejected order remains Submitted and must be cancelled and replaced if the buyer wants to revise and resubmit it.
- Supplier notification occurs by both email and supplier-portal notification when a valid order is submitted, including when the order is awaiting approval. Notification does not waive the approval requirement.
- Buyers can select from existing branch, supplier, and product records, and existing access controls determine which buyers and approvers are authorized.
- Only Draft orders are editable. Submitted, Approved, Fulfilled, and Cancelled orders retain their submitted details; a correction requires cancellation and a new order.
- For orders not requiring approval, fulfillment may follow Submitted status. For orders requiring approval, fulfillment may follow Approved status.
